import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Buffer } from 'node:buffer';
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
  buildThreadTitle,
  createPersonalAiThread,
  getPersonalAiAgentForUse,
  getPersonalAiMemory,
  getPersonalAiThreadWithMessages,
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
  3_500_000,
  250_000,
  5_000_000,
);
const INLINE_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
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
  if (path.endsWith('.gif')) return 'image/gif';
  return '';
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

  const bytes = await res.Body.transformToByteArray();
  if (
    bytes.byteLength <= 0 ||
    bytes.byteLength > MAX_SERVER_VISION_IMAGE_BYTES
  ) {
    return item;
  }

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
  const hydrated: PersonalAiMediaContext[] = [];
  for (const item of media) {
    try {
      hydrated.push(await hydratePrivateImageFromMinio(item, userId));
    } catch (error) {
      console.warn('[PERSONAL_AI_MEDIA_HYDRATE_ERROR]', {
        name: item.name,
        error: error instanceof Error ? error.message : String(error),
      });
      hydrated.push(item);
    }
  }
  return hydrated;
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
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const kind = cleanMediaKind(record.kind);
    const name = cleanText(record.name, 140) || 'media';
    const mime = cleanText(record.mime, 120);
    const size = Math.max(
      0,
      Math.min(5_000_000, Number(record.size || 0) || 0),
    );
    const rawDataUrl = cleanText(record.data_url || record.dataUrl, 2_200_000);
    const dataUrl =
      kind === 'image' &&
      /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(rawDataUrl)
        ? rawDataUrl
        : undefined;
    const text = cleanText(record.text, 1600);
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
    if (result.length >= 4) break;
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

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit({
    key: `rl:ai:personal-chat:${auth.ctx.userId}:${ip}`,
    limit: 36,
    windowSeconds: 60,
    message: 'Too many AI chat requests. Please retry shortly.',
  });
  if (!rate.ok) return rate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const media = await hydrateMediaForVision(
    cleanMediaAttachments(body.attachments || body.media),
    auth.ctx.userId,
  );
  const message =
    cleanText(body.message, 3500) ||
    (media.length > 0
      ? localeText(
          body.locale === 'en' ? 'en' : 'id',
          'Tolong analisis media ini.',
          'Please analyze this media.',
        )
      : '');
  if (!message && media.length === 0) {
    return NextResponse.json({ error: 'Kirim pesan dulu.' }, { status: 400 });
  }

  const locale = body.locale === 'en' ? 'en' : 'id';
  const actionInstruction = cleanText(
    body.action_instruction || body.actionInstruction,
    1600,
  );
  const replyToMessageId = cleanText(
    body.reply_to_message_id || body.replyToMessageId,
    160,
  );
  const agentId = cleanText(body.agent_id, 120);
  const shareId = cleanText(body.share_id, 120);
  const threadId = cleanText(body.thread_id, 120);

  const agent = await getPersonalAiAgentForUse({
    userId: auth.ctx.userId,
    agentId: agentId || undefined,
    shareId: shareId || undefined,
  });
  if (!agent) {
    return NextResponse.json({ error: 'AI not found.' }, { status: 404 });
  }

  let threadData = threadId
    ? await getPersonalAiThreadWithMessages(auth.ctx.userId, threadId)
    : null;
  if (threadData && threadData.thread.agent_id !== agent.id) {
    threadData = null;
  }

  const thread =
    threadData?.thread ||
    (await createPersonalAiThread(
      auth.ctx.userId,
      agent.id,
      buildThreadTitle(message),
    ));
  const history = threadData?.messages || [];
  const replyTarget = replyToMessageId
    ? history.find(item => item.id === replyToMessageId)
    : undefined;
  if (replyToMessageId && !replyTarget) {
    return NextResponse.json(
      { error: 'Pesan yang dibalas tidak ditemukan di chat ini.' },
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
  const memory = await getPersonalAiMemory(agent.id, auth.ctx.userId);
  const mediaMetadata = mediaStorageMetadata(media);
  const previousCreationFlow = latestCollectingCreationFlow(history);
  const requestedCreationTargetValue =
    body.creation_target || body.creationTarget;
  const requestedCreationTarget = isSupportedCreationTarget(
    requestedCreationTargetValue,
  )
    ? requestedCreationTargetValue
    : undefined;
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
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('[PERSONAL_AI_CHAT_RUNTIME_ERROR]', {
        agent_id: agent.id,
        media_count: media.length,
        error: errorMessage,
      });
      ai = {
        response:
          locale === 'id'
            ? creationFlow?.status === 'ready'
              ? 'Informasi inti sudah cukup. Draft sedang disiapkan dan tetap bisa kamu perbaiki sebelum diterbitkan.'
              : 'Pesanmu sudah diterima, tapi AI sedang gagal memproses respons. Coba kirim ulang sebentar lagi.'
            : creationFlow?.status === 'ready'
              ? 'The core information is complete. Your draft is being prepared and can still be edited before publishing.'
              : 'Your message was received, but the AI failed to process a response. Please retry shortly.',
        provider: 'safe-fallback',
        model: 'personal-ai-fallback',
        provider_errors: [`runtime: ${errorMessage}`],
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
      provider_errors: ai.provider_errors,
      media_count: mediaMetadata.length,
      has_action_instruction: Boolean(actionInstruction),
      creation_flow: creationFlow || undefined,
      shared_agent_owner_id:
        agent.owner_id !== auth.ctx.userId ? agent.owner_id : undefined,
    },
  });
  if (!creationFlow || creationFlow.status === 'ready') {
    await updatePersonalAiMemory({
      agent,
      userId: auth.ctx.userId,
      userMessage: message,
      assistantMessage: ai.response,
    }).catch(error => {
      console.warn('[PERSONAL_AI_MEMORY_UPDATE_ERROR]', {
        agent_id: agent.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return NextResponse.json({
    data: {
      thread,
      messages: [saved.userMessage, saved.assistantMessage],
      response: ai.response,
      provider: ai.provider,
      model: ai.model,
      provider_errors: ai.provider_errors,
      creation_flow: creationFlow || undefined,
    },
  });
}

function localeText(locale: 'id' | 'en', id: string, en: string) {
  return locale === 'id' ? id : en;
}
