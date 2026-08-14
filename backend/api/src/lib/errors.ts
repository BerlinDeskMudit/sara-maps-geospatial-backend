export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof AppError) {
    return { error: { code: err.code, message: err.message, details: err.details } };
  }
  const e = err as { statusCode?: number; code?: string; message?: string };
  const status = e.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    return {
      error: {
        code: e.code ?? 'BAD_REQUEST',
        message: e.message ?? 'Request failed',
        details: {},
      },
    };
  }
  return {
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: {} },
  };
}
