import { Component, input } from '@angular/core';

/**
 * What a screen shows when there is nothing to show yet. Always says what to do next:
 * the call to action is projected in, so it can be a router link or a button.
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <span class="icon" aria-hidden="true"><i [class]="icon()"></i></span>
    <p class="title">{{ heading() }}</p>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    <div class="actions">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--et-s6) var(--et-s4);
    }

    :host(.compact) {
      padding: var(--et-s5) var(--et-s3);
    }

    .icon {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      margin-bottom: var(--et-s3);
      border: 1px solid var(--et-line);
      border-radius: 50%;
      background: var(--et-surface-2);
      color: var(--et-kept);
    }

    .title {
      margin: 0;
      font-weight: 600;
      color: var(--et-text);
    }

    .message {
      margin: var(--et-s1) 0 0;
      max-width: 28rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--et-muted);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--et-s2);
      margin-top: var(--et-s4);
    }

    .actions:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('pi pi-inbox');
  readonly heading = input.required<string>();
  readonly message = input<string>();
}
