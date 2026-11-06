import { Component, computed, input } from '@angular/core';

import { TransactionType } from '../core/models';
import { transactionTypeLabel } from '../core/labels';

/** Expense or income, in the colour that means it everywhere else: coral out, cyan in. */
@Component({
  selector: 'app-type-badge',
  template: `{{ label() }}`,
  host: {
    '[class.out]': "type() === 'EXPENSE'",
    '[class.in]': "type() === 'INCOME'",
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }

    :host(.out) {
      color: var(--et-out);
      background: color-mix(in srgb, var(--et-out) 14%, transparent);
    }

    :host(.in) {
      color: var(--et-in);
      background: color-mix(in srgb, var(--et-in) 14%, transparent);
    }
  `,
})
export class TypeBadgeComponent {
  readonly type = input.required<TransactionType>();
  protected readonly label = computed(() => transactionTypeLabel(this.type()));
}
