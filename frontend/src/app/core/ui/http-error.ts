import { HttpErrorResponse } from '@angular/common/http';

/** The RFC 7807 body the backend's GlobalExceptionHandler returns. */
interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
  fieldErrors?: Record<string, string>;
}

function isProblemDetail(body: unknown): body is ProblemDetail {
  return typeof body === 'object' && body !== null && ('detail' in body || 'title' in body);
}

/**
 * Turns any failed request into one sentence a person can act on: the server's own
 * `detail` when it sent one, otherwise a message chosen by status, otherwise the fallback.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Server neodpovedá. Skontroluj pripojenie a skús to znova.';
  }

  const body: unknown = error.error;
  if (isProblemDetail(body)) {
    const fields = body.fieldErrors ? Object.values(body.fieldErrors).filter(Boolean) : [];
    if (fields.length) {
      return fields.join(' ');
    }
    if (body.detail) {
      return body.detail;
    }
  }

  if (error.status >= 500) {
    return 'Na serveri sa niečo pokazilo. Skús to o chvíľu znova.';
  }

  return fallback;
}
