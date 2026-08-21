import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  runPersonalAi,
  type PersonalAiMediaContext,
} from '@/lib/personal-ai/runtime';
import {
  buildCreationIntakeMessage,
  buildCreationReadyInstruction,
  evaluateCreationFlow,
  readCreationFlowMetadata,
  type CreationFlowMetadata,
} from '@/lib/creation-drafts/conversation';
import { isSupportedCreationTarget } from '@/lib/creation-drafts/types';
import {
  appendPersonalAiMessages,
  assertPersonalAiMessageCapacity,
  assertPersonalAiThreadCapacity,
  buildThreadTitle,
  claimPersonalAiChatRequest,
  createPersonalAiThread,
  getPersonalAiAgentForUse,
  getPersonalAiMemory,
  getPersonalAiThreadWithMessages,
  hashPersonalAiChatRequest,
  isPersonalAiMemoryEnabled,
  normalizePersonalAiClientRef,
  PersonalAiQuotaExceededError,
  releasePersonalAiChatRequest,
  resolvePersonalAiQuickButtonAction,
  updatePersonalAiMemory,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'laju-chat';
const MAX_SERVER_VISION_IMAGE_BYTES = cleanInteger(
  process.env.PERSONAL_AI_SERVER_VISION_IMAGE_BYTES,
  2_000_000,
  250_000,
  2_200_000,
);
const MAX_REQUEST_BODY_BYTES = cleanInteger(
  process.env.PERSONAL_AI_CHAT_MAX_BODY_BYTES,
  13_000_000,
  1_000_000,
  14_000_000,
);
const MAX_INLINE_DATA_URL_CHARS = 2_950_000;
const MAX_TOTAL_INLINE_DATA_URL_CHARS = 9_000_000;
const MAX_ATTACHMENTS = 4;
const INLINE_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

let cachedS3Client: S3Client | null = null;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function safeUserKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getS3Client(): S3Client | null {
  if (cachedS3Client) return cachedS3Client;
  if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) return null;
  cachedS3Client = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  return cachedS3Client;
}

function decodeSafePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function parsePersonalAiMediaUrl(url: string, userId: string) {
  const cleanUrl = cleanText(url, 600);
  if (!cleanUrl) return null;

  const pathname = cleanUrl.startsWith('/')
    ? cleanUrl
    : (() => {
        try {
          return new URL(cleanUrl).pathname;
        } catch {
          return '';
        }
      })();

  const prefix = '/api/ai/personal/media/';
  if (!pathname.startsWith(prefix)) return null;

  const parts = pathname
    .slice(prefix.length)
    .split('/')
    .map(decodeSafePathSegment)
    .filter(Boolean);
  if (parts.length !== 4) return null;

  const [bucket, root, owner, filename] = parts;
  if (bucket !== MINIO_BUCKET || root !== 'personal-ai') return null;
  if (owner !== safeUserKey(userId)) return null;
  if (
    ![root, owner, filename].every(segment => SAFE_KEY_SEGMENT.test(segment))
  ) {
    return null;
  }

  return {
    bucket,
    key: `${root}/${owner}/${filename}`,
  };
}

function mimeForImageKey(key: string, fallback: string) {
  const normalized = fallback.toLowerCase();
  if (INLINE_IMAGE_MIME.has(normalized)) return normalized;
  const path = key.split(/[?#]/, 1)[0]?.toLowerCase() || '';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return '';
}


async function readS3BodyLimited(
  body: unknown,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!body) return null;

  const candidate = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | Buffer | string>;
  };

  if (typeof candidate[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const rawChunk of candidate as AsyncIterable<
      Uint8Array | Buffer | string
    >) {
      const chunk =
        typeof rawChunk === 'string'
          ? Buffer.from(rawChunk)
          : Buffer.from(rawChunk);

      total += chunk.byteLength;
      if (total > maxBytes) return null;
      chunks.push(chunk);
    }

    return Buffer.concat(chunks, total);
  }

  if (typeof candidate.transformToByteArray === 'function') {
    const bytes = await candidate.transformToByteArray();
    if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) return null;
    return bytes;
  }

  return null;
}

async function hydratePrivateImageFromMinio(
  item: PersonalAiMediaContext,
  userId: string,
) {
  if (item.kind !== 'image' || item.dataUrl || !item.url) return item;

  const target = parsePersonalAiMediaUrl(item.url, userId);
  const client = target ? getS3Client() : null;
  if (!target || !client) return item;

  const res = await client.send(
    new GetObjectCommand({ Bucket: target.bucket, Key: target.key }),
  );
  if (!res.Body) return item;

  const contentLength = Number(res.ContentLength || 0);
  if (contentLength > MAX_SERVER_VISION_IMAGE_BYTES) return item;

  const bytes = await readS3BodyLimited(
    res.Body,
    MAX_SERVER_VISION_IMAGE_BYTES,
  );
  if (!bytes || bytes.byteLength <= 0) return item;

  const mime = mimeForImageKey(target.key, item.mime || res.ContentType || '');
  if (!mime) return item;

  return {
    ...item,
    mime,
    size: bytes.byteLength,
    dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
  };
}

async function hydrateMediaForVision(
  media: PersonalAiMediaContext[],
  userId: string,
) {
  const settled = await Promise.allSettled(
    media.map(item => hydratePrivateImageFromMinio(item, userId)),
  );

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    const item = media[index];
    console.warn('[PERSONAL_AI_MEDIA_HYDRATE_ERROR]', {
      name: item?.name || 'media',
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    });
    return item;
  });
}

function cleanMediaKind(value: unknown): PersonalAiMediaContext['kind'] {
  if (
    value === 'image' ||
    value === 'video' ||
    value === 'audio' ||
    value === 'document'
  ) {
    return value;
  }
  return 'file';
}

function cleanMediaAttachments(value: unknown): PersonalAiMediaContext[] {
  if (!Array.isArray(value)) return [];

  const result: PersonalAiMediaContext[] = [];
  let totalInlineChars = 0;

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const kind = cleanMediaKind(record.kind);
    const name = cleanText(record.name, 140) || 'media';
    let mime = cleanText(record.mime, 120).toLowerCase();
    let size = Math.max(
      0,
      Math.min(5_000_000, Number(record.size || 0) || 0),
    );

    const rawDataUrl = cleanText(
      record.data_url || record.dataUrl,
      MAX_INLINE_DATA_URL_CHARS,
    );

    let dataUrl: string | undefined;
    if (kind === 'image' && rawDataUrl) {
      const match =
        /^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=]+)$/i.exec(
          rawDataUrl,
        );

      if (match) {
        const normalizedMime =
          match[1].toLowerCase() === 'image/jpg'
            ? 'image/jpeg'
            : match[1].toLowerCase();
        const estimatedBytes = Math.max(
          0,
          Math.floor((match[2].length * 3) / 4) -
            (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0),
        );

        if (
          INLINE_IMAGE_MIME.has(normalizedMime) &&
          estimatedBytes > 0 &&
          estimatedBytes <= MAX_SERVER_VISION_IMAGE_BYTES &&
          totalInlineChars + rawDataUrl.length <=
            MAX_TOTAL_INLINE_DATA_URL_CHARS
        ) {
          dataUrl = rawDataUrl;
          mime = normalizedMime;
          size = estimatedBytes;
          totalInlineChars += rawDataUrl.length;
        }
      }
    }

    const text = cleanText(record.text, 3500);
    const url = cleanText(
      record.url || record.stored_url || record.storedUrl,
      500,
    );

    result.push({
      kind,
      name,
      mime,
      size,
      dataUrl,
      text: text || undefined,
      url: url || undefined,
    });

    if (result.length >= MAX_ATTACHMENTS) break;
  }

  return result;
}

function mediaStorageMetadata(media: PersonalAiMediaContext[]) {
  return media.map(item => ({
    kind: item.kind,
    name: item.name,
    mime: item.mime,
    size: item.size,
    url: item.url,
    has_inline_image: Boolean(item.dataUrl),
    has_text: Boolean(item.text),
  }));
}

function latestCollectingCreationFlow(
  history: Array<{ metadata?: Record<string, unknown> }>,
): CreationFlowMetadata | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const flow = readCreationFlowMetadata(
      history[index]?.metadata?.creation_flow,
    );
    if (!flow) continue;
    return flow.status === 'collecting' ? flow : null;
  }
  return null;
}


function requestIdFrom(req: NextRequest) {
  const supplied = cleanText(req.headers.get('x-request-id'), 128);
  if (supplied && /^[a-zA-Z0-9._:-]+$/.test(supplied)) return supplied;
  return `pai-${randomUUID()}`;
}

function jsonResponse(
  requestId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function readJsonBodyLimited(
  req: NextRequest,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (
    contentType &&
    !contentType.includes('application/json') &&
    !contentType.includes('+json')
  ) {
    throw Object.assign(new Error('CONTENT_TYPE_REQUIRED'), { status: 415 });
  }

  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
  }

  if (!req.body) return {};

  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), { status: 400 });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('JSON_OBJECT_REQUIRED'), { status: 400 });
  }

  return parsed as Record<string, unknown>;
}

function safeApiError(
  requestId: string,
  error: unknown,
  fallbackStatus = 500,
) {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    Number.isInteger(Number((error as { status?: unknown }).status))
      ? Math.max(
          400,
          Math.min(599, Number((error as { status?: unknown }).status)),
        )
      : fallbackStatus;

  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const publicMessage =
    code === 'REQUEST_TOO_LARGE'
      ? 'Request terlalu besar.'
      : code === 'INVALID_JSON'
        ? 'Body JSON tidak valid.'
        : code === 'JSON_OBJECT_REQUIRED'
          ? 'Body request harus berupa object JSON.'
          : code === 'CONTENT_TYPE_REQUIRED'
            ? 'Content-Type harus application/json.'
            : 'Terjadi kendala saat memproses Personal AI. Coba lagi.';

  return jsonResponse(
    requestId,
    {
      error: publicMessage,
      code: code.match(/^[A-Z0-9_]+$/) ? code.toLowerCase() : 'internal_error',
    },
    { status },
  );
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  const startedAt = Date.now();

  const auth = await requireAuth(req);
  if (!auth.ok) {
    auth.res.headers.set('X-Request-Id', requestId);
    auth.res.headers.set('Cache-Control', 'no-store');
    return auth.res;
  }

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-chat:${auth.ctx.userId}:${ip}`,
    limit: 36,
    windowSeconds: 60,
    message: 'Too many AI chat requests. Please retry shortly.',
  });
  if (!rate.ok) {
    rate.response.headers.set('X-Request-Id', requestId);
    rate.response.headers.set('Cache-Control', 'no-store');
    return rate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyLimited(req, MAX_REQUEST_BODY_BYTES);
  } catch (error) {
    return safeApiError(requestId, error, 400);
  }

  const locale = body.locale === 'en' ? 'en' : 'id';

  const media = await hydrateMediaForVision(
    cleanMediaAttachments(body.attachments || body.media),
    auth.ctx.userId,
  );

  let message =
    cleanText(body.message, 3500) ||
    (media.length > 0
      ? localeText(
          locale,
          'Tolong analisis media ini.',
          'Please analyze this media.',
        )
      : '');

  if (!message && media.length === 0) {
    return jsonResponse(
      requestId,
      { error: 'Kirim pesan dulu.', code: 'message_required' },
      { status: 400 },
    );
  }

  const clientRef = normalizePersonalAiClientRef(
    body.client_ref || body.clientRef,
  );
  if (!clientRef) {
    return jsonResponse(
      requestId,
      {
        error:
          'client_ref must be 12-128 characters using letters, numbers, dot, underscore, colon, or dash.',
        code: 'invalid_client_ref',
      },
      { status: 400 },
    );
  }

  const quickButtonId = cleanText(
    body.quick_button_id || body.quickButtonId,
    80,
  );
  const replyToMessageId = cleanText(
    body.reply_to_message_id || body.replyToMessageId,
    160,
  );
  const agentId = cleanText(body.agent_id || body.agentId, 120);
  const shareId = cleanText(body.share_id || body.shareId, 120);
  const threadId = cleanText(body.thread_id || body.threadId, 120);

  let requestHash = '';
  let claimOwned = false;
  let claimCompleted = false;

  try {
    const agent = await getPersonalAiAgentForUse({
      userId: auth.ctx.userId,
      agentId: agentId || undefined,
      shareId: shareId || undefined,
    });

    if (!agent) {
      return jsonResponse(
        requestId,
        { error: 'AI not found.', code: 'ai_not_found' },
        { status: 404 },
      );
    }

    const quickButtonAction = resolvePersonalAiQuickButtonAction({
      agent,
      viewerUserId: auth.ctx.userId,
      publicButtonId: quickButtonId,
    });

    if (quickButtonId && !quickButtonAction) {
      return jsonResponse(
        requestId,
        { error: 'Quick action not found.', code: 'invalid_quick_button' },
        { status: 400 },
      );
    }

    if (quickButtonAction) message = quickButtonAction.prompt;
    const actionInstruction = quickButtonAction?.instruction || '';

    let threadData = threadId
      ? await getPersonalAiThreadWithMessages(auth.ctx.userId, threadId)
      : null;

    if (threadData && threadData.thread.agent_id !== agent.id) {
      threadData = null;
    }

    const history = threadData?.messages || [];
    const replyTarget = replyToMessageId
      ? history.find(item => item.id === replyToMessageId)
      : undefined;

    if (replyToMessageId && !replyTarget) {
      return jsonResponse(
        requestId,
        {
          error: 'Pesan yang dibalas tidak ditemukan di chat ini.',
          code: 'reply_target_not_found',
        },
        { status: 404 },
      );
    }

    const replyMetadata = replyTarget
      ? {
          message_id: replyTarget.id,
          role: replyTarget.role,
          excerpt: cleanText(replyTarget.content, 500),
        }
      : undefined;

    const replyInstruction = replyTarget
      ? locale === 'id'
        ? `User sedang membalas pesan ${replyTarget.role} berikut:\n"${cleanText(replyTarget.content, 900)}"\nJawab dalam konteks kutipan ini tanpa kehilangan konteks percakapan aktif.`
        : `The user is replying to this ${replyTarget.role} message:\n"${cleanText(replyTarget.content, 900)}"\nRespond in the context of this quote without losing the active conversation context.`
      : '';

    const mediaMetadata = mediaStorageMetadata(media);
    const previousCreationFlow = latestCollectingCreationFlow(history);
    const requestedCreationTargetValue =
      body.creation_target || body.creationTarget;
    const requestedCreationTarget = isSupportedCreationTarget(
      requestedCreationTargetValue,
    )
      ? requestedCreationTargetValue
      : undefined;

    requestHash = hashPersonalAiChatRequest({
      agent_id: agent.id,
      thread_id: threadData?.thread.id || '',
      message,
      quick_button_id: quickButtonId,
      reply_to_message_id: replyToMessageId,
      creation_target: requestedCreationTarget || '',
      locale,
      media,
    });

    const claim = await claimPersonalAiChatRequest({
      userId: auth.ctx.userId,
      clientRef,
      agentId: agent.id,
      requestHash,
    });

    if (claim.status === 'completed') {
      return jsonResponse(requestId, claim.response, {
        headers: { 'X-Idempotent-Replay': 'true' },
      });
    }

    if (claim.status === 'processing') {
      return jsonResponse(
        requestId,
        {
          error: 'Request with this client_ref is still processing.',
          code: 'request_in_progress',
        },
        { status: 409, headers: { 'Retry-After': '3' } },
      );
    }

    if (claim.status === 'conflict') {
      return jsonResponse(
        requestId,
        {
          error: 'client_ref was already used for a different request.',
          code: 'client_ref_conflict',
        },
        { status: 409 },
      );
    }

    claimOwned = true;

    if (threadData?.thread) {
      await assertPersonalAiMessageCapacity(
        auth.ctx.userId,
        threadData.thread.id,
        2,
      );
    } else {
      await assertPersonalAiThreadCapacity(auth.ctx.userId);
    }

    let thread = threadData?.thread;
    if (!thread) {
      thread = await createPersonalAiThread(
        auth.ctx.userId,
        agent.id,
        buildThreadTitle(message),
      );
    }

    const memoryEnabled = await isPersonalAiMemoryEnabled({
      agent,
      userId: auth.ctx.userId,
    });
    const memory = memoryEnabled
      ? await getPersonalAiMemory(agent.id, auth.ctx.userId)
      : null;

    const activeCreationTarget =
      requestedCreationTarget || previousCreationFlow?.target;
    const creationFlow = activeCreationTarget
      ? evaluateCreationFlow({
          target: activeCreationTarget,
          message,
          locale,
          previous:
            previousCreationFlow?.target === activeCreationTarget
              ? previousCreationFlow
              : null,
          media: mediaMetadata,
        })
      : null;

    let ai: Awaited<ReturnType<typeof runPersonalAi>>;

    if (creationFlow && creationFlow.status !== 'ready') {
      ai = {
        response: buildCreationIntakeMessage(creationFlow, locale),
        provider: 'guided-creation',
        model: 'guided-creation-v1',
        provider_errors: [],
      };
    } else {
      try {
        ai = await runPersonalAi({
          agent,
          memory,
          message,
          actionInstruction: [
            actionInstruction,
            replyInstruction,
            creationFlow?.status === 'ready'
              ? buildCreationReadyInstruction(creationFlow, locale)
              : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          history,
          locale,
          media,
          // Keep this. The gateway-only runtime should forward it to ai_service
          // as X-Request-Id for end-to-end tracing.
          requestId,
        });

        const normalizedResponse = cleanText(ai.response, 20_000);
        if (!normalizedResponse) {
          throw new Error('PERSONAL_AI_EMPTY_RESPONSE');
        }

        ai = {
          ...ai,
          response: normalizedResponse,
          provider: cleanText(ai.provider, 80) || 'ai-service',
          model: cleanText(ai.model, 160) || 'unknown',
          provider_errors: Array.isArray(ai.provider_errors)
            ? ai.provider_errors
                .filter(item => typeof item === 'string')
                .map(item => cleanText(item, 220))
                .filter(Boolean)
                .slice(0, 6)
            : [],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.warn('[PERSONAL_AI_CHAT_RUNTIME_ERROR]', {
          request_id: requestId,
          agent_id: agent.id,
          media_count: media.length,
          error: errorMessage.slice(0, 400),
        });

        ai = {
          response:
            locale === 'id'
              ? creationFlow?.status === 'ready'
                ? 'Informasi inti sudah cukup, tetapi layanan AI sedang tidak tersedia. Coba lagi untuk menghasilkan draft.'
                : 'Pesanmu sudah diterima, tetapi layanan AI sedang tidak tersedia. Coba kirim ulang sebentar lagi.'
              : creationFlow?.status === 'ready'
                ? 'The core information is complete, but the AI service is currently unavailable. Retry to generate the draft.'
                : 'Your message was received, but the AI service is currently unavailable. Please retry shortly.',
          provider: 'safe-fallback',
          model: 'personal-ai-fallback',
          provider_errors: ['provider_unavailable'],
        };
      }
    }

    const saved = await appendPersonalAiMessages({
      userId: auth.ctx.userId,
      agentId: agent.id,
      threadId: thread.id,
      userContent: message,
      assistantContent: ai.response,
      userMetadata:
        mediaMetadata.length > 0 || replyMetadata
          ? {
              ...(mediaMetadata.length > 0 ? { media: mediaMetadata } : {}),
              ...(replyMetadata ? { reply_to: replyMetadata } : {}),
            }
          : undefined,
      metadata: {
        provider: ai.provider,
        model: ai.model,
        provider_errors:
          ai.provider_errors.length > 0 ? ['provider_unavailable'] : [],
        media_count: mediaMetadata.length,
        has_action_instruction: Boolean(actionInstruction),
        creation_flow: creationFlow || undefined,
        request_id: requestId,
      },
      requestCompletion: {
        clientRef,
        requestHash,
        buildResponse: ({ userMessage, assistantMessage }) => {
          const providerErrors = Array.isArray(
            assistantMessage.metadata.provider_errors,
          )
            ? assistantMessage.metadata.provider_errors.filter(
                (item): item is string => typeof item === 'string',
              )
            : [];

          return {
            data: {
              thread,
              messages: [userMessage, assistantMessage],
              response: ai.response,
              provider: ai.provider,
              model: ai.model,
              provider_errors: providerErrors,
              creation_flow: creationFlow || undefined,
              request_id: requestId,
            },
          };
        },
      },
    });

    // requestCompletion has atomically persisted the idempotent response.
    claimCompleted = true;

    const responseBody = saved.completedResponse;
    if (!responseBody) {
      throw new Error('PERSONAL_AI_COMPLETION_MISSING');
    }

    // Never feed a transport/error fallback into durable memory.
    if (
      (!creationFlow || creationFlow.status === 'ready') &&
      ai.provider !== 'safe-fallback'
    ) {
      await updatePersonalAiMemory({
        agent,
        userId: auth.ctx.userId,
        userMessage: message,
        assistantMessage: ai.response,
        sharedRecipientConsent: memoryEnabled,
      }).catch(error => {
        console.warn('[PERSONAL_AI_MEMORY_UPDATE_ERROR]', {
          request_id: requestId,
          agent_id: agent.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    const response = jsonResponse(requestId, responseBody);
    response.headers.set(
      'Server-Timing',
      `personal-ai;dur=${Math.max(0, Date.now() - startedAt)}`,
    );
    return response;
  } catch (error) {
    if (error instanceof PersonalAiQuotaExceededError) {
      return personalAiQuotaResponse(error, requestId);
    }

    console.error('[PERSONAL_AI_CHAT_ERROR]', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(
      requestId,
      {
        error: 'Personal AI gagal memproses request.',
        code: 'personal_ai_internal_error',
      },
      { status: 500 },
    );
  } finally {
    if (claimOwned && !claimCompleted && requestHash) {
      await releasePersonalAiChatRequest({
        userId: auth.ctx.userId,
        clientRef,
        requestHash,
      }).catch(error => {
        console.warn('[PERSONAL_AI_REQUEST_RELEASE_ERROR]', {
          request_id: requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}

function localeText(locale: 'id' | 'en', id: string, en: string) {
  return locale === 'id' ? id : en;
}

function personalAiQuotaResponse(
  error: PersonalAiQuotaExceededError,
  requestId: string,
) {
  return jsonResponse(
    requestId,
    {
      error: error.message,
      code: error.code,
      quota: { resource: error.resource, limit: error.limit },
    },
    { status: 409 },
  );
}