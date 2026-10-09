import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeSk from '@angular/common/locales/sk';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfirmationService, MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { PageTitleStrategy } from './core/ui/page-title.strategy';
import { primeNgSk } from './core/ui/primeng-sk';
import { environment } from '../environments/environment';
import { ExpenseTrackerTheme } from './theme';

registerLocaleData(localeSk);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'sk' },
    provideBrowserGlobalErrorListeners(),
    // Query params bind to route component inputs (the transactions filters live in the URL).
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      // Omitted entirely when unset, so PrimeNG does not try to verify an empty key.
      ...(environment.primeNgLicense ? { license: environment.primeNgLicense } : {}),
      translation: primeNgSk,
      theme: {
        preset: ExpenseTrackerTheme,
        options: {
          // The app is dark-only; the class sits on <html> in index.html.
          darkModeSelector: '.app-dark',
        },
      },
    }),
    // One toast host and one confirm dialog for the whole app, both rendered in App.
    MessageService,
    ConfirmationService,
  ],
};
