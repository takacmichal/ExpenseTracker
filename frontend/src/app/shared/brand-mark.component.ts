import { Component, input } from '@angular/core';

import { APP_NAME } from '../core/ui/page-title.strategy';

/** The amber "SK" plate and the wordmark, shared by the shell and the auth screens. */
@Component({
  selector: 'app-brand-mark',
  template: `
    <span class="mark" aria-hidden="true">SK</span>
    @if (showName()) {
      <span class="wordmark">{{ name }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 1.875rem;
      height: 1.875rem;
      border-radius: var(--et-radius-sm);
      background: var(--et-kept);
      color: var(--p-primary-contrast-color);
      font-family: var(--et-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .wordmark {
      font-size: 1.0625rem;
      font-weight: 600;
      letter-spacing: -0.015em;
    }
  `,
})
export class BrandMarkComponent {
  readonly showName = input(true);
  protected readonly name = APP_NAME;
}
