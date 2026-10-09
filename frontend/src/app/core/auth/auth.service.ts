import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

import { AuthResponse, UserSummary } from '../models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'et.token';
const USER_KEY = 'et.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // User first: readUser() clears both keys when the stored user is corrupt.
  private readonly currentUser = signal<UserSummary | null>(this.readUser());
  private readonly token = signal<string | null>(this.readToken());

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  constructor() {
    // Another tab logged in, changed the password (new token) or logged out: follow it, so this
    // tab neither keeps sending a revoked token nor wipes the session the other tab just stored.
    const onStorage = (event: StorageEvent) => this.syncFromStorage(event);
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  getToken(): string | null {
    return this.token();
  }

  register(email: string, password: string, name: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, { email, password, name })
      .pipe(tap((response) => this.persist(response)));
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((response) => this.persist(response)));
  }

  /**
   * Ends this tab's session. If another tab has meanwhile stored a different token (a new login or
   * a password change), that session is adopted instead of being wiped out from under it.
   */
  logout(): void {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored !== null && stored !== this.token()) {
      this.adoptStoredSession();
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.clearSession();
  }

  /** Keeps the cached user (shown in the sidebar) in step after a profile edit. */
  updateUser(user: UserSummary): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /** Swaps in a session issued elsewhere, e.g. after a password change revoked the old token. */
  acceptSession(response: AuthResponse): void {
    this.persist(response);
  }

  private persist(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.token.set(response.token);
    this.currentUser.set(response.user);
  }

  /** `key === null` means another tab called `localStorage.clear()`. */
  private syncFromStorage(event: StorageEvent): void {
    if (event.storageArea !== localStorage) {
      return;
    }
    if (event.key === USER_KEY) {
      if (this.token() !== null && event.newValue !== null) {
        this.currentUser.set(this.readUser());
      }
      return;
    }
    if (event.key !== TOKEN_KEY && event.key !== null) {
      return;
    }
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored === this.token()) {
      return;
    }
    const wasLoggedOut = this.token() === null;
    const previousUserId = this.currentUser()?.id;
    if (stored === null) {
      this.clearSession();
    } else {
      this.adoptStoredSession();
      const userId = this.currentUser()?.id;
      if (!wasLoggedOut && userId !== undefined && userId !== previousUserId) {
        // A different user signed in elsewhere: drop everything this tab loaded for the old one.
        window.location.reload();
        return;
      }
      if (wasLoggedOut && this.token() !== null) {
        // Logged in elsewhere while this tab sat on /login or /register.
        void this.router.navigate(['/dashboard']);
      }
    }
  }

  private adoptStoredSession(): void {
    const user = this.readUser();
    const token = this.readToken();
    if (token === null) {
      // readUser() found a corrupt user and cleared both keys.
      this.clearSession();
      return;
    }
    this.token.set(token);
    this.currentUser.set(user);
  }

  /** Drops the in-memory session only; storage is the caller's business. */
  private clearSession(): void {
    this.token.set(null);
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  private readToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private readUser(): UserSummary | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as UserSummary;
    } catch {
      // A corrupt entry must not break every route and request; start logged out instead.
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }
}
