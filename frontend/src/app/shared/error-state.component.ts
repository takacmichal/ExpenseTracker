import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { errorMessage } from '../core/ui/http-error';

/** A failed load: what went wrong, in the server's words when it gave any, and a retry. */
@Component({
  selector: 'app-error-state',
  imports: [ButtonModule],
  template: `
    <div class="box" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
      <div class="text">
        <p class="title">{{ heading() }}</p>
        <p class="message">{{ message() }}</p>
      </div>
      <p-button
        label="Skúsiť znova"
        icon="pi pi-refresh"
        severity="secondary"
        [outlined]="true"
        size="small"
        (onClick)="retry.emit()"
      />
    </div>
  `,
  styles: `
    .box {
      display: flex;
      align-items: center;
      gap: var(--et-s3) var(--et-s4);
      flex-wrap: wrap;
      padding: var(--et-s4) var(--et-s5);
      border: 1px solid color-mix(in srgb, var(--et-out) 45%, var(--et-line));
      border-radius: var(--et-radius);
      background: color-mix(in srgb, var(--et-out) 7%, var(--et-surface));
    }

    i {
      font-size: 1.25rem;
      color: var(--et-out);
    }

    .text {
      flex: 1;
      min-width: 12rem;
    }

    .title {
      margin: 0;
      font-weight: 600;
    }

    .message {
      margin: 0.125rem 0 0;
      font-size: 0.875rem;
      color: var(--et-muted);
    }
  `,
})
export class ErrorStateComponent {
  readonly heading = input('Dáta sa nepodarilo načítať');
  readonly error = input<unknown>();
  readonly retry = output<void>();

  protected readonly message = computed(() =>
    errorMessage(this.error(), 'Skontroluj pripojenie a skús to znova.'),
  );
}
