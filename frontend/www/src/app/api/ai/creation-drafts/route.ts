import { NextRequest, NextResponse } from 'next/server';
import { generateCreationDraft, detectCreationTarget } from '@/lib/creation-drafts/generator';
import {
  buildCreationDraftContinueUrl,
  isSupportedCreationTarget,
  type AICreationDraft,
  type DraftMedia,
} from '@/lib/creation-drafts/types';
import { promotePersonalAiMedia } from '@/lib/minio';
import { attachCreationDraftToPersonalAiMessage } from '@/lib/personal-ai/store';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const CREATION_DRAFT_ID = /^drf_[a-f0-9]{32}$/;

type IncomingMedia = {
  kind?: unknown;
  type?: unknown;
  name?: unknown;
  url?: unknown;
  mime?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\u0000/g, '').trim().slice(0, maxLength)
    : '';
}

function mergeDefinedRecords(
  base: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const merged = { ...base };
  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') merged[key] = value;
  });
  return merged;
}

function draftMediaType(value: unknown): DraftMedia['type'] | null {
  if (value === 'image') return 'image';
  if (value === 'video') return 'video';
  if (value === 'document' || value === 'file') return 'document';
  return null;
}

async function prepareOwnedMedia(value: unknown, ownerId: string): Promise<DraftMedia[]> {
  if (!Array.isArray(value)) return [];
  const result: DraftMedia[] = [];
  for (const raw of value.slice(0, 10)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as IncomingMedia;
    const type = draftMediaType(item.kind || item.type);
    const sourceUrl = cleanText(item.url, 700);
    if (!type || !sourceUrl) continue;

    let assetUrl = sourceUrl;
    if (sourceUrl.startsWith('/api/ai/personal/media/')) {
      if (type === 'image') {
        assetUrl = (await promotePersonalAiMedia({ url: sourceUrl, ownerId })).url;
      } else if (!sourceUrl.includes(`/personal-ai/${ownerId}/`)) {
        throw new Error('Media is not owned by the authenticated user');
      }
    } else {
      throw new Error('Creation media must come from the private Profile AI upload');
    }

    result.push({
      assetId: assetUrl,
      type,
      purpose: result.length === 0 && type === 'image' ? 'cover' : 'gallery',
      order: result.length,
      altText: cleanText(item.name, 140) || undefined,
      url: assetUrl,
    });
  }
  return result;
}

async function readMarketplaceResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { data?: AICreationDraft; error?: string };
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const rate = await enforceRateLimit({
    key: `rl:ai:creation-draft:${auth.ctx.userId}:${getClientIp(req.headers)}`,
    limit: 12,
    windowSeconds: 60 * 60,
    message: 'Terlalu banyak draft AI. Coba lagi nanti.',
  });
  if (!rate.ok) return rate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const locale = body.locale === 'en' ? 'en' : 'id';
  const instruction = cleanText(body.instruction || body.message, 3500);
  const assistantContext = cleanText(
    body.assistantContext || body.assistant_context,
    5000,
  );
  const explicitTarget = isSupportedCreationTarget(body.target)
    ? body.target
    : undefined;
  const existingDraftId = cleanText(body.draftId || body.draft_id, 80);
  let existingDraft: AICreationDraft | undefined;
  if (existingDraftId) {
    if (!CREATION_DRAFT_ID.test(existingDraftId)) {
      return NextResponse.json({ error: 'Draft AI tidak ditemukan.' }, { status: 404 });
    }
    try {
      const existingResponse = await fetch(
        new URL(
          `/v1/creation-drafts/${encodeURIComponent(existingDraftId)}`,
          MARKETPLACE_URL,
        ),
        {
          headers: { Authorization: `Bearer ${auth.ctx.token}` },
          cache: 'no-store',
        },
      );
      const existingPayload = await readMarketplaceResponse(existingResponse);
      if (!existingResponse.ok || !existingPayload.data) {
        return NextResponse.json(
          { error: 'Draft AI tidak ditemukan atau sudah tidak aktif.' },
          { status: existingResponse.status === 404 ? 404 : 409 },
        );
      }
      existingDraft = existingPayload.data;
    } catch (error) {
      console.error(
        '[AI_CREATION_DRAFT_LOAD_ERROR]',
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { error: 'Layanan draft AI sedang tidak tersedia.' },
        { status: 503 },
      );
    }
  }
  const target =
    explicitTarget ||
    (isSupportedCreationTarget(existingDraft?.target)
      ? existingDraft.target
      : undefined) ||
    detectCreationTarget(`${instruction}\n${assistantContext}`);
  if (!instruction) {
    return NextResponse.json({ error: 'Instruksi pembuatan wajib diisi.' }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json(
      {
        error: 'Pilih dulu jenis konten yang ingin dibuat.',
        requiresTarget: true,
        targets: ['offering_listing', 'looking_for_listing', 'business_profile'],
      },
      { status: 422 },
    );
  }
  if (existingDraft && existingDraft.target !== target) {
    return NextResponse.json(
      { error: 'Jenis draft tidak dapat diubah saat diperbaiki.' },
      { status: 409 },
    );
  }

  let media: DraftMedia[];
  try {
    const incomingMedia = await prepareOwnedMedia(
      body.media || body.attachments,
      auth.ctx.userId,
    );
    media = incomingMedia.length > 0 ? incomingMedia : existingDraft?.media || [];
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Media tidak dapat dipakai untuk draft.',
      },
      { status: 400 },
    );
  }

  const generated = await generateCreationDraft({
    target,
    instruction,
    assistantContext: existingDraft
      ? `${assistantContext}\nDraft saat ini: ${JSON.stringify({
          title: existingDraft.title,
          summary: existingDraft.summary,
          payload: existingDraft.payload,
        })}`.slice(0, 5000)
      : assistantContext,
    media,
    locale,
  });
  const storedPayload = existingDraft
    ? mergeDefinedRecords(
        existingDraft.payload as Record<string, unknown>,
        generated.payload as unknown as Record<string, unknown>,
      )
    : generated.payload;
  const sourceConversationId = cleanText(
    body.conversationId || body.conversation_id,
    160,
  );
  const idempotencyKey = cleanText(
    body.idempotencyKey || body.idempotency_key,
    180,
  );

  try {
    const response = await fetch(
      new URL(
        existingDraft
          ? `/v1/creation-drafts/${encodeURIComponent(existingDraft.id)}`
          : '/v1/creation-drafts',
        MARKETPLACE_URL,
      ),
      {
      method: existingDraft ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.ctx.token}`,
      },
      body: JSON.stringify({
        ...(existingDraft
          ? {
              expected_version: existingDraft.draftVersion,
              updated_by: 'ai',
            }
          : {
              target: generated.target,
              source_conversation_id: sourceConversationId || undefined,
              created_by: 'ai',
              idempotency_key: idempotencyKey || undefined,
            }),
        payload: storedPayload,
        media,
        field_metadata: generated.fieldMetadata,
        title: generated.title,
        summary: generated.summary,
        completeness_score: generated.completenessScore,
        missing_required_fields: generated.missingRequiredFields,
        warnings: generated.warnings,
      }),
      cache: 'no-store',
    });
    const payload = await readMarketplaceResponse(response);
    if (!response.ok || !payload.data) {
      console.warn('[AI_CREATION_DRAFT_STORE_ERROR]', {
        status: response.status,
        error: payload.error,
      });
      return NextResponse.json(
        { error: 'Draft AI belum dapat disimpan. Coba lagi.' },
        { status: response.status >= 400 && response.status < 500 ? response.status : 503 },
      );
    }
    const data = {
      ...payload.data,
      continueUrl: buildCreationDraftContinueUrl(locale, payload.data),
    };
    const assistantMessageId = cleanText(
      body.assistantMessageId || body.assistant_message_id,
      160,
    );
    if (assistantMessageId) {
      await attachCreationDraftToPersonalAiMessage({
        userId: auth.ctx.userId,
        messageId: assistantMessageId,
        draft: data as unknown as Record<string, unknown>,
      }).catch(error => {
        console.warn('[AI_CREATION_DRAFT_MESSAGE_LINK_ERROR]', {
          messageId: assistantMessageId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return NextResponse.json(
      { data, provider: generated.provider },
      { status: response.status },
    );
  } catch (error) {
    console.error('[AI_CREATION_DRAFT_ERROR]',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Layanan draft AI sedang tidak tersedia.' },
      { status: 503 },
    );
  }
}
