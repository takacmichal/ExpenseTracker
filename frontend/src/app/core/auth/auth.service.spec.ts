import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { AuthResponse } from '../models';

const RESPONSE: AuthResponse = {
  token: 'jwt-123',
  expiresIn: 86400,
  user: { id: 'u1', email: 'jana@example.sk', name: 'Jana' },
};

describe('AuthService', () => {
  let http: HttpTestingController;
  let router: Router;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('starts unauthenticated with an empty localStorage', () => {
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getToken()).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it('restores the token and user from localStorage', () => {
    localStorage.setItem('et.token', 'stored');
    localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getToken()).toBe('stored');
    expect(auth.user()).toEqual(RESPONSE.user);
  });

  it('login posts credentials and persists the response', () => {
    const auth = setup();
    let result: AuthResponse | undefined;
    auth.login('jana@example.sk', 'secret').subscribe((r) => (result = r));

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'jana@example.sk', password: 'secret' });
    req.flush(RESPONSE);

    expect(result).toEqual(RESPONSE);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getToken()).toBe('jwt-123');
    expect(auth.user()).toEqual(RESPONSE.user);
    expect(localStorage.getItem('et.token')).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem('et.user')!)).toEqual(RESPONSE.user);
  });

  it('register posts email, password and name and persists the response', () => {
    const auth = setup();
    auth.register('jana@example.sk', 'secret', 'Jana').subscribe();

    const req = http.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'jana@example.sk',
      password: 'secret',
      name: 'Jana',
    });
    req.flush(RESPONSE);

    expect(auth.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('et.token')).toBe('jwt-123');
  });

  it('a failed login leaves the user logged out and storage untouched', () => {
    const auth = setup();
    let failed = false;
    auth.login('jana@example.sk', 'wrong').subscribe({ error: () => (failed = true) });

    http
      .expectOne('/api/auth/login')
      .flush({ detail: 'Nesprávne údaje.' }, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('et.token')).toBeNull();
  });

  it('logout clears signals and storage and navigates to /login', () => {
    localStorage.setItem('et.token', 'stored');
    localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
    const auth = setup();

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getToken()).toBeNull();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem('et.token')).toBeNull();
    expect(localStorage.getItem('et.user')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout adopts a newer token another tab stored instead of wiping it', () => {
    localStorage.setItem('et.token', 'old');
    localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
    const auth = setup();
    const renamed = { ...RESPONSE.user, name: 'Jana N.' };
    localStorage.setItem('et.token', 'new');
    localStorage.setItem('et.user', JSON.stringify(renamed));

    auth.logout();

    expect(auth.getToken()).toBe('new');
    expect(auth.user()).toEqual(renamed);
    expect(localStorage.getItem('et.token')).toBe('new');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('sync across tabs', () => {
    function storageEvent(key: string | null, newValue: string | null): void {
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue, storageArea: localStorage }),
      );
    }

    it('adopts a token another tab stored (e.g. after a password change)', () => {
      localStorage.setItem('et.token', 'old');
      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      const auth = setup();

      localStorage.setItem('et.token', 'new');
      storageEvent('et.token', 'new');

      expect(auth.getToken()).toBe('new');
      expect(auth.isAuthenticated()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('logs this tab out when another tab removed the token', () => {
      localStorage.setItem('et.token', 'stored');
      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      const auth = setup();

      localStorage.removeItem('et.token');
      localStorage.removeItem('et.user');
      storageEvent('et.token', null);

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.user()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('treats localStorage.clear() in another tab as a logout', () => {
      localStorage.setItem('et.token', 'stored');
      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      const auth = setup();

      localStorage.clear();
      storageEvent(null, null);

      expect(auth.isAuthenticated()).toBe(false);
    });

    it('a login in another tab moves this tab off the login page', () => {
      const auth = setup();

      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      localStorage.setItem('et.token', 'jwt-123');
      storageEvent('et.token', 'jwt-123');

      expect(auth.getToken()).toBe('jwt-123');
      expect(auth.user()).toEqual(RESPONSE.user);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('follows a profile edit made in another tab', () => {
      localStorage.setItem('et.token', 'stored');
      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      const auth = setup();
      const renamed = { ...RESPONSE.user, name: 'Jana N.' };

      localStorage.setItem('et.user', JSON.stringify(renamed));
      storageEvent('et.user', JSON.stringify(renamed));

      expect(auth.user()).toEqual(renamed);
    });

    it('ignores unrelated keys', () => {
      localStorage.setItem('et.token', 'stored');
      localStorage.setItem('et.user', JSON.stringify(RESPONSE.user));
      const auth = setup();

      localStorage.removeItem('et.token');
      storageEvent('something.else', 'x');

      expect(auth.getToken()).toBe('stored');
    });
  });
});
