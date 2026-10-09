import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { FeedbackService } from '../ui/feedback.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string | null;
  const auth = {
    getToken: () => token,
    isAuthenticated: () => token !== null,
    logout: vi.fn((): void => {
      token = null;
    }),
  };
  const feedback = { info: vi.fn() };

  beforeEach(() => {
    token = null;
    auth.logout.mockClear();
    feedback.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: FeedbackService, useValue: feedback },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token when logged in', () => {
    token = 'jwt-abc';
    http.get('/api/accounts').subscribe();
    const req = backend.expectOne('/api/accounts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc');
    req.flush([]);
  });

  it('sends no Authorization header when logged out', () => {
    http.get('/api/accounts').subscribe();
    const req = backend.expectOne('/api/accounts');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('logs out and informs the user on a 401 outside /auth', () => {
    token = 'expired';
    let status: number | undefined;
    http.get('/api/transactions').subscribe({ error: (e) => (status = e.status) });

    backend.expectOne('/api/transactions').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(feedback.info).toHaveBeenCalledWith(
      'Prihlásenie vypršalo',
      'Prihlás sa, prosím, znova.',
    );
    expect(status).toBe(401); // error is still propagated to the caller
  });

  it('ignores a 401 for a token that was replaced while the request was in flight', () => {
    token = 'before-password-change';
    let status: number | undefined;
    http.get('/api/transactions').subscribe({ error: (e) => (status = e.status) });

    token = 'after-password-change';
    backend.expectOne('/api/transactions').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(feedback.info).not.toHaveBeenCalled();
  });

  it('stays quiet when logout adopted a newer session from another tab', () => {
    token = 'jwt';
    auth.logout.mockImplementationOnce(() => {
      token = 'from-other-tab';
    });
    http.get('/api/accounts').subscribe({ error: () => undefined });

    backend.expectOne('/api/accounts').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(feedback.info).not.toHaveBeenCalled();
  });

  it('does not log out on a 401 from an /auth/ endpoint (wrong password)', () => {
    token = 'old';
    let failed = false;
    http.post('/api/auth/login', {}).subscribe({ error: () => (failed = true) });

    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(feedback.info).not.toHaveBeenCalled();
  });

  it('does not log out on a 401 when no one is logged in', () => {
    http.get('/api/accounts').subscribe({ error: () => undefined });
    backend.expectOne('/api/accounts').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])('passes a %i through without logging out', (status) => {
    token = 'jwt';
    let received: number | undefined;
    http.get('/api/accounts').subscribe({ error: (e) => (received = e.status) });
    backend.expectOne('/api/accounts').flush(null, { status, statusText: 'Error' });
    expect(received).toBe(status);
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
