import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { environment } from '../environments/environment';
import { ExpenseTrackerTheme } from './theme';

registerLocaleData(localeSk);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'sk' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      // Omitted entirely when unset, so PrimeNG does not try to verify an empty key.
      ...(environment.primeNgLicense ? { license: environment.primeNgLicense } : {}),
      theme: {
        preset: ExpenseTrackerTheme,
        options: {
          // The app is dark-only; the class sits on <html> in index.html.
          darkModeSelector: '.app-dark',
        },
      },
    }),
    MessageService,
  ],
};
