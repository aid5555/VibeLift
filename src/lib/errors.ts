/**
 * Typed application error hierarchy.
 *
 * Every domain failure should use one of these classes (or a subclass) so that
 * API routes can map errors to structured responses via `src/lib/response.ts`.
 */
export abstract class AppError extends Error {
  /** Stable machine-readable error code (e.g. `VALIDATION_ERROR`). */
  abstract readonly code: string;
  /** HTTP status code used when this error surfaces through an API route. */
  abstract readonly statusCode: number;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Raised when required environment variables are missing or malformed. */
export class EnvValidationError extends AppError {
  readonly code = 'ENV_VALIDATION_ERROR';
  readonly statusCode = 500;
}

/** Raised when request/input data fails schema validation. */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, readonly details?: unknown) {
    super(message);
  }
}

/** Raised when a requested resource does not exist. */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

/** Raised when an external API (Lyfta, AI) fails or returns an error. */
export class ExternalApiError extends AppError {
  readonly code = 'EXTERNAL_API_ERROR';
  readonly statusCode = 502;

  constructor(
    message: string,
    readonly upstreamStatus?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Raised when a database operation fails. */
export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
}
