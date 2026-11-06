import { HttpErrorResponse } from '@angular/common/http';

import { errorMessage } from './http-error';

const FALLBACK = 'Fallback.';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: '/api/x' });
}

describe('errorMessage', () => {
  it('returns the fallback for non-HTTP errors', () => {
    expect(errorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(errorMessage('boom', FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('reports an unreachable server for status 0', () => {
    expect(errorMessage(httpError(0, new ProgressEvent('error')), FALLBACK)).toBe(
      'Server neodpovedá. Skontroluj pripojenie a skús to znova.',
    );
  });

  it('prefers status 0 even when a body is present', () => {
    expect(errorMessage(httpError(0, { detail: 'ignored' }), FALLBACK)).toContain(
      'Server neodpovedá',
    );
  });

  it('uses ProblemDetail.detail', () => {
    const error = httpError(409, { title: 'Conflict', status: 409, detail: 'Účet už existuje.' });
    expect(errorMessage(error, FALLBACK)).toBe('Účet už existuje.');
  });

  it('joins field errors and prefers them over detail', () => {
    const error = httpError(400, {
      title: 'Bad Request',
      detail: 'Validation failed',
      fieldErrors: { email: 'Neplatný e-mail.', password: 'Príliš krátke heslo.' },
    });
    expect(errorMessage(error, FALLBACK)).toBe('Neplatný e-mail. Príliš krátke heslo.');
  });

  it('skips empty field errors and falls back to detail when none remain', () => {
    const error = httpError(400, {
      title: 'Bad Request',
      detail: 'Zlé údaje.',
      fieldErrors: { a: '' },
    });
    expect(errorMessage(error, FALLBACK)).toBe('Zlé údaje.');
  });

  it('uses the fallback for a 4xx ProblemDetail with only a title', () => {
    expect(errorMessage(httpError(404, { title: 'Not Found' }), FALLBACK)).toBe(FALLBACK);
  });

  it('uses the server detail for 5xx when present', () => {
    expect(errorMessage(httpError(500, { detail: 'DB down.' }), FALLBACK)).toBe('DB down.');
  });

  it.each([500, 502, 503])('uses a generic server message for %i without detail', (status) => {
    expect(errorMessage(httpError(status, 'Bad Gateway'), FALLBACK)).toBe(
      'Na serveri sa niečo pokazilo. Skús to o chvíľu znova.',
    );
  });

  it('uses the fallback for 4xx with a non-ProblemDetail body', () => {
    expect(errorMessage(httpError(403, 'Forbidden'), FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(httpError(400, null), FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(httpError(400, { message: 'x' }), FALLBACK)).toBe(FALLBACK);
  });
});
