import { Component, input } from '@angular/core';

/**
 * Top of every authenticated screen: an engraved panel label, the page heading and, on the
 * right, whatever actions the screen projects in. Actions wrap under the title on phones.
 */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="text">
      <p class="et-eyebrow">{{ eyebrow() }}</p>
      <h1>{{ heading() }}</h1>
      @if (description()) {
        <p class="description">{{ description() }}</p>
      }
    </div>
    <div class="actions">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--et-s3) var(--et-s4);
      flex-wrap: wrap;
      margin-bottom: var(--et-s5);
    }

    .text {
      min-width: 0;
    }

    p.et-eyebrow {
      margin: 0;
    }

    h1 {
      margin: var(--et-s1) 0 0;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h1::first-letter {
      text-transform: uppercase;
    }

    .description {
      margin: var(--et-s2) 0 0;
      max-width: 40rem;
      font-size: 0.9375rem;
      line-height: 1.5;
      color: var(--et-muted);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
      flex-wrap: wrap;
    }

    .actions:empty {
      display: none;
    }

    @media (max-width: 600px) {
      h1 {
        font-size: 1.5rem;
      }
    }
  `,
})
export class PageHeaderComponent {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input<string>();
}
