export type ApiErrorEnvelope = {
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
  status?: number;
};

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toApiHttpError(status: number, payload: unknown): ApiHttpError {
  if (payload && typeof payload === 'object') {
    const envelope = payload as ApiErrorEnvelope;
    return new ApiHttpError(
      envelope.error || envelope.message || `Request failed with status ${status}`,
      status,
      envelope.code,
      envelope.details,
    );
  }
  return new ApiHttpError(`Request failed with status ${status}`, status);
}
