import { Component, input } from '@angular/core';

import { BrandMarkComponent } from '../../shared/brand-mark.component';

/** The frame shared by login and registration: brand, heading, the form, a footer link. */
@Component({
  selector: 'app-auth-card',
  imports: [BrandMarkComponent],
  template: `
    <main class="auth et-grid">
      <div class="card">
        <app-brand-mark class="brand" />
        <h1>{{ heading() }}</h1>
        <p class="sub">{{ subtitle() }}</p>
        <ng-content />
        <p class="switch"><ng-content select="[authSwitch]" /></p>
      </div>
    </main>
  `,
  styles: `
    .auth {
      display: grid;
      place-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: var(--et-s5) var(--et-s4);
    }

    .card {
      width: 100%;
      max-width: 23rem;
      padding: var(--et-s6);
      border: 1px solid var(--et-line);
      border-radius: 1rem;
      background: var(--et-surface);
    }

    .brand {
      margin-bottom: 1.75rem;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .sub {
      margin: 0.375rem 0 1.75rem;
      font-size: 0.9375rem;
      color: var(--et-muted);
      line-height: 1.5;
    }

    .switch {
      margin: var(--et-s5) 0 0;
      text-align: center;
      font-size: 0.875rem;
      color: var(--et-faint);
    }

    @media (max-width: 420px) {
      .card {
        padding: var(--et-s5) 1.25rem;
      }
    }
  `,
})
export class AuthCardComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input.required<string>();
}
