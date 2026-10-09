import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { FeedbackService } from '../ui/feedback.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const feedback = inject(FeedbackService);
  const token = auth.getToken();

  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // There is no refresh token: a 401 outside /auth means the JWT expired or was revoked. Only
      // if it is still the current one, though: a request sent before a password change (here or
      // in another tab) fails with the old token while the new session is perfectly valid.
      if (
        error.status === 401 &&
        !req.url.includes('/auth/') &&
        token !== null &&
        token === auth.getToken()
      ) {
        auth.logout();
        // logout() adopts a newer session another tab stored meanwhile; only then is all well.
        if (!auth.isAuthenticated()) {
          feedback.info('Prihlásenie vypršalo', 'Prihlás sa, prosím, znova.');
        }
      }
      return throwError(() => error);
    }),
  );
};
