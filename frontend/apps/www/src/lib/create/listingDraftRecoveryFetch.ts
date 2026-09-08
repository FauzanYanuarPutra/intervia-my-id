import {
  readTemporaryCreateDraft,
  renewTemporaryCreateDraftAfterMissingServerDraft,
  writeTemporaryCreateDraft,
  type DraftMedia,
  type TemporaryCreateDraft,
} from './createDraftStorage';

type DraftReader = (ownerId: string) => TemporaryCreateDraft | null;
type DraftWriter = (
  ownerId: string,
  draft: TemporaryCreateDraft,
) => TemporaryCreateDraft;

type RecoveryFetchOptions = {
  ownerId: string;
  baseFetch: typeof fetch;
  readDraft?: DraftReader;
  writeDraft?: DraftWriter;
  baseUrl?: string;
};

type PublishedContent = Record<string, unknown>;

type DraftRoute = {
  id: string;
  publish: boolean;
  url: URL;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function parseUrl(
  input: RequestInfo | URL,
  baseUrl: string,
): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url, baseUrl);
    return new URL(input instanceof URL ? input.toString() : input, baseUrl);
  } catch {
    return null;
  }
}

function parseDraftRoute(
  input: RequestInfo | URL,
  baseUrl: string,
): DraftRoute | null {
  const url = parseUrl(input, baseUrl);
  const base = new URL(baseUrl);
  if (!url || url.origin !== base.origin) return null;

  const match = url.pathname.match(
    /^\/api\/listing-drafts\/([^/]+?)(\/publish)?$/,
  );
  if (!match) return null;

  try {
    return {
      id: decodeURIComponent(match[1]),
      publish: Boolean(match[2]),
      url,
    };
  } catch {
    return null;
  }
}

function methodFor(input: RequestInfo | URL, init?: RequestInit): string {
  return (
    init?.method ||
    (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
}

function mergedHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): Headers {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

function requestCredentials(
  input: RequestInfo | URL,
  init?: RequestInit,
): RequestCredentials {
  return (
    init?.credentials ||
    (input instanceof Request ? input.credentials : 'same-origin')
  );
}

async function readJsonBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  let raw = init?.body;

  if (raw === undefined && input instanceof Request) {
    try {
      raw = await input.clone().text();
    } catch {
      return {};
    }
  }

  if (typeof raw !== 'string' || !raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rewriteDraftUrl(route: DraftRoute, nextId: string): string {
  const next = new URL(route.url.toString());
  next.pathname = `/api/listing-drafts/${encodeURIComponent(nextId)}${
    route.publish ? '/publish' : ''
  }`;
  return next.toString();
}

function rewriteInput(
  input: RequestInfo | URL,
  nextUrl: string,
): RequestInfo | URL {
  if (input instanceof Request) {
    return new Request(nextUrl, input);
  }
  return input instanceof URL ? new URL(nextUrl) : nextUrl;
}

function normalizeDraftMedia(value: unknown): DraftMedia[] | undefined {
  return Array.isArray(value) ? (value as DraftMedia[]) : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(item => readString(item))
    .filter(Boolean);
}

function publishedContentOwner(content: PublishedContent): string {
  return readString(content.owner_id) || readString(content.ownerId);
}

function publishedContentId(content: PublishedContent): string {
  return readString(content.id);
}

function syntheticPublishedSave(content: PublishedContent): Response {
  return jsonResponse({
    draft: {
      id: publishedContentId(content),
      current_step: 9,
      already_published: true,
    },
  });
}

function syntheticPublishedResult(content: PublishedContent): Response {
  return jsonResponse({ listing: content });
}

function copyPatchProgressIntoLocalDraft(
  draft: TemporaryCreateDraft,
  patch: Record<string, unknown>,
): TemporaryCreateDraft {
  const values = isRecord(patch.values) ? patch.values : draft.formValues;
  const media = normalizeDraftMedia(patch.media) || draft.media;
  const industryIds = normalizeStringArray(patch.industry_ids) || draft.industryIds;
  const currentStep = readFiniteNumber(patch.current_step) ?? draft.currentStep;

  return {
    ...draft,
    currentStep: Math.max(1, Math.min(9, Math.trunc(currentStep))),
    formValues: values,
    media,
    industryIds,
  };
}

function buildCreatePayload(
  draft: TemporaryCreateDraft,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    intent: draft.intent,
    category_slug: draft.categorySlug,
    subcategory_slug: draft.subcategorySlug,
    industry_ids: normalizeStringArray(patch.industry_ids) || draft.industryIds,
    current_step: readFiniteNumber(patch.current_step) ?? draft.currentStep,
    values: isRecord(patch.values) ? patch.values : draft.formValues,
    media: normalizeDraftMedia(patch.media) || draft.media,
    idempotency_key: draft.idempotencyKey,
  };

  const completion = readFiniteNumber(patch.completion_percentage);
  if (completion !== undefined) {
    payload.completion_percentage = completion;
  }

  return payload;
}

async function parseResponseRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = (await response.clone().json()) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createListingDraftRecoveryFetch({
  ownerId,
  baseFetch,
  readDraft = readTemporaryCreateDraft,
  writeDraft = writeTemporaryCreateDraft,
  baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.lajukan.com',
}: RecoveryFetchOptions): typeof fetch {
  const replacementByStaleId = new Map<string, string>();
  const publishedByDraftId = new Map<string, PublishedContent>();

  const recoveryFetch: typeof fetch = async (input, init) => {
    const route = parseDraftRoute(input, baseUrl);
    if (!route) return baseFetch(input, init);

    const method = methodFor(input, init);
    const patchBody =
      method === 'PATCH' && !route.publish
        ? await readJsonBody(input, init)
        : {};

    const knownPublished = publishedByDraftId.get(route.id);
    if (knownPublished) {
      if (route.publish && method === 'POST') {
        return syntheticPublishedResult(knownPublished);
      }
      if (!route.publish && method === 'PATCH') {
        return syntheticPublishedSave(knownPublished);
      }
    }

    const mappedId = replacementByStaleId.get(route.id);
    if (mappedId) {
      const mappedUrl = rewriteDraftUrl(route, mappedId);
      let mappedInit = init;

      if (!route.publish && method === 'PATCH') {
        const currentLocalDraft = readDraft(ownerId);
        const currentVersion =
          currentLocalDraft?.draftId === mappedId
            ? currentLocalDraft.draftVersion
            : undefined;
        if (currentVersion !== undefined) {
          mappedInit = {
            ...init,
            headers: mergedHeaders(input, init),
            body: JSON.stringify({
              ...patchBody,
              expected_version: currentVersion,
            }),
          };
        }
      }

      return baseFetch(rewriteInput(input, mappedUrl), mappedInit);
    }

    const originalResponse = await baseFetch(input, init);

    if (route.publish && method === 'POST' && originalResponse.ok) {
      const payload = await parseResponseRecord(originalResponse);
      if (isRecord(payload.listing)) {
        publishedByDraftId.set(route.id, payload.listing);
      }
      return originalResponse;
    }

    if (
      route.publish ||
      method !== 'PATCH' ||
      originalResponse.status !== 404
    ) {
      return originalResponse;
    }

    const localDraft = readDraft(ownerId);
    if (
      !localDraft ||
      !localDraft.intent ||
      !localDraft.categorySlug ||
      !localDraft.subcategorySlug
    ) {
      return originalResponse;
    }

    const headers = mergedHeaders(input, init);
    const credentials = requestCredentials(input, init);
    const signal = init?.signal;

    const contentUrl = new URL(
      `/api/content/${encodeURIComponent(route.id)}`,
      baseUrl,
    ).toString();
    const contentResponse = await baseFetch(contentUrl, {
      method: 'GET',
      headers,
      credentials,
      cache: 'no-store',
      signal,
    });

    if (contentResponse.ok) {
      const content = await parseResponseRecord(contentResponse);
      const contentId = publishedContentId(content);
      const contentOwner = publishedContentOwner(content);

      if (contentId && contentOwner === ownerId) {
        publishedByDraftId.set(route.id, content);
        return syntheticPublishedSave(content);
      }

      // A content item exists but ownership cannot be proven. Never create a
      // replacement in this case because that could duplicate another item.
      return originalResponse;
    }

    // Only a definitive not-found is safe to heal by creating a replacement.
    // Transient/permission failures must fail closed instead of duplicating data.
    if (contentResponse.status !== 404) {
      return originalResponse;
    }

    const latestProgress = copyPatchProgressIntoLocalDraft(localDraft, patchBody);
    const renewed = renewTemporaryCreateDraftAfterMissingServerDraft(latestProgress);
    writeDraft(ownerId, renewed);

    const createHeaders = new Headers(headers);
    createHeaders.set('Content-Type', 'application/json');
    const createResponse = await baseFetch(
      new URL('/api/listing-drafts', baseUrl).toString(),
      {
        method: 'POST',
        headers: createHeaders,
        credentials,
        signal,
        body: JSON.stringify(buildCreatePayload(renewed, patchBody)),
      },
    );

    if (!createResponse.ok) return createResponse;

    const createPayload = await parseResponseRecord(createResponse);
    const createdDraft = isRecord(createPayload.draft)
      ? createPayload.draft
      : {};
    const replacementId = readString(createdDraft.id);
    if (!replacementId) return createResponse;

    const replacementVersion = readFiniteNumber(createdDraft.draft_version);
    replacementByStaleId.set(route.id, replacementId);

    writeDraft(ownerId, {
      ...renewed,
      draftId: replacementId,
      draftVersion: replacementVersion,
    });

    const retryHeaders = new Headers(headers);
    retryHeaders.set('Content-Type', 'application/json');
    const retryBody: Record<string, unknown> = {
      ...patchBody,
    };
    if (replacementVersion !== undefined) {
      retryBody.expected_version = replacementVersion;
    } else {
      delete retryBody.expected_version;
    }

    return baseFetch(
      new URL(
        `/api/listing-drafts/${encodeURIComponent(replacementId)}`,
        baseUrl,
      ).toString(),
      {
        ...init,
        method: 'PATCH',
        headers: retryHeaders,
        credentials,
        signal,
        body: JSON.stringify(retryBody),
      },
    );
  };

  return recoveryFetch;
}
