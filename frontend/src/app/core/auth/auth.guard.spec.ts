import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  const authenticated = signal(false);

  beforeEach(() => {
    authenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: authenticated.asReadonly() } },
      ],
    });
  });

  function run(guard: typeof authGuard) {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  function serialize(result: unknown): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('lets an authenticated user through', () => {
      authenticated.set(true);
      expect(run(authGuard)).toBe(true);
    });

    it('redirects a guest to /login', () => {
      expect(serialize(run(authGuard))).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('lets a guest through', () => {
      expect(run(guestGuard)).toBe(true);
    });

    it('redirects an authenticated user to /dashboard', () => {
      authenticated.set(true);
      expect(serialize(run(guestGuard))).toBe('/dashboard');
    });
  });
});
