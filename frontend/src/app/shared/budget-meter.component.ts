import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

import { BudgetStatus } from '../core/models';
import { UNCATEGORISED_COLOR } from '../theme';

/**
 * One budget read as a gauge: amber while it holds, coral once it is exceeded or the
 * month-end projection says it will be. A tick marks the projection in the month in progress.
 */
@Component({
  selector: 'app-budget-meter',
  imports: [CurrencyPipe, DecimalPipe],
  host: {
    '[class.warn]': 'warn()',
    '[class.compact]': 'compact()',
  },
  template: `
    <div class="head">
      <span class="name">
        @if (status().categoryId) {
          <span class="et-dot" [style.background]="status().categoryColor ?? uncategorised"></span>
        } @else {
          <i class="pi pi-wallet overall-icon" aria-hidden="true"></i>
        }
        <span class="et-truncate">{{ label() }}</span>
      </span>
      <span class="pct et-num">{{ status().percentUsed | number: '1.0-0' }} %</span>
    </div>

    <div
      class="track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="fill()"
      [attr.aria-valuetext]="valueText()"
      [attr.aria-label]="'Rozpočet ' + label()"
    >
      <span class="fill" [style.width.%]="fill()"></span>
      @if (projectionMark(); as mark) {
        <span class="mark" [style.left.%]="mark" aria-hidden="true"></span>
      }
    </div>

    @if (compact()) {
      <p class="line et-num">
        <span>{{ status().spent | currency: 'EUR' }}</span>
        <span class="et-faint"> / {{ status().amountLimit | currency: 'EUR' }}</span>
      </p>
    } @else {
      <dl class="figures">
        <div>
          <dt class="et-eyebrow">Minuté</dt>
          <dd class="et-num">{{ status().spent | currency: 'EUR' }}</dd>
        </div>
        <div>
          <dt class="et-eyebrow">Limit</dt>
          <dd class="et-num">{{ status().amountLimit | currency: 'EUR' }}</dd>
        </div>
        <div>
          <dt class="et-eyebrow">{{ status().remaining >= 0 ? 'Zostáva' : 'Prekročené o' }}</dt>
          <dd
            class="et-num"
            [class.et-kept]="status().remaining >= 0"
            [class.et-out]="status().remaining < 0"
          >
            {{ absRemaining() | currency: 'EUR' }}
          </dd>
        </div>
      </dl>

      @if (projected() !== null) {
        <p class="projection" [class.et-out]="projectedOver()">
          <i
            class="pi"
            [class.pi-exclamation-triangle]="projectedOver()"
            [class.pi-chart-line]="!projectedOver()"
            aria-hidden="true"
          ></i>
          Odhad na koniec mesiaca
          <strong class="et-num">{{ projected() | currency: 'EUR' }}</strong>
          @if (projectedOver() && !status().exceeded) {
            <span class="warn-note">pri tomto tempe limit prekročíš</span>
          }
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      --meter-color: var(--et-kept);
    }

    :host(.warn) {
      --meter-color: var(--et-out);
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--et-s3);
      margin-bottom: var(--et-s2);
    }

    .name {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
      min-width: 0;
      font-weight: 600;
    }

    .overall-icon {
      font-size: 0.875rem;
      color: var(--et-kept);
    }

    .pct {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--meter-color);
    }

    .track {
      position: relative;
      height: 0.5rem;
      border-radius: 999px;
      background: var(--et-surface-2);
      overflow: visible;
    }

    .fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--meter-color);
      transition: width 0.3s ease;
    }

    .mark {
      position: absolute;
      top: -0.1875rem;
      width: 2px;
      height: calc(100% + 0.375rem);
      margin-left: -1px;
      border-radius: 1px;
      background: var(--et-text);
      opacity: 0.6;
    }

    .figures {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--et-s3);
      margin: var(--et-s4) 0 0;
    }

    .figures div {
      min-width: 0;
    }

    dd {
      margin: 0.125rem 0 0;
      font-size: 1rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .projection {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.25rem 0.375rem;
      margin: var(--et-s3) 0 0;
      font-size: 0.8125rem;
      color: var(--et-muted);
    }

    .warn-note {
      flex-basis: 100%;
    }

    .projection.et-out {
      color: var(--et-out);
    }

    .line {
      margin: 0.375rem 0 0;
      font-size: 0.8125rem;
    }

    :host(.compact) .head {
      margin-bottom: 0.375rem;
      font-size: 0.9375rem;
    }

    :host(.compact) .name {
      font-weight: 500;
    }

    @media (max-width: 400px) {
      dd {
        font-size: 0.875rem;
      }
    }
  `,
})
export class BudgetMeterComponent {
  readonly status = input.required<BudgetStatus>();
  readonly compact = input(false);

  protected readonly uncategorised = UNCATEGORISED_COLOR;

  protected readonly label = computed(() => this.status().categoryName ?? 'Celkový rozpočet');
  protected readonly fill = computed(() => Math.min(100, Math.max(0, this.status().percentUsed)));
  protected readonly absRemaining = computed(() => Math.abs(this.status().remaining));

  /** Only the month in progress carries a projection. */
  protected readonly projected = computed(() => this.status().projectedSpend ?? null);

  protected readonly projectedOver = computed(() => {
    const projected = this.projected();
    return projected !== null && projected > this.status().amountLimit;
  });

  protected readonly warn = computed(() => this.status().exceeded || this.projectedOver());

  protected readonly projectionMark = computed(() => {
    const projected = this.projected();
    const limit = this.status().amountLimit;
    if (projected === null || limit <= 0 || projected <= this.status().spent) {
      return null;
    }
    return Math.min(100, (projected / limit) * 100);
  });

  protected readonly valueText = computed(() => {
    const format = (value: number) =>
      value.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
    const s = this.status();
    return `Minuté ${format(s.spent)} z ${format(s.amountLimit)} (${Math.round(s.percentUsed)} %)`;
  });
}
