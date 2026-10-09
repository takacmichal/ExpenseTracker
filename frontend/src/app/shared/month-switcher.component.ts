import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

import { addMonths, isSameMonth } from '../core/date-utils';

/**
 * Previous / pick / next month. Stateless: the screen holds the month (in the URL) and
 * navigates on `changed`. The future is off limits, there is nothing to show there yet.
 */
@Component({
  selector: 'app-month-switcher',
  imports: [FormsModule, ButtonModule, DatePickerModule],
  template: `
    <p-button
      icon="pi pi-chevron-left"
      severity="secondary"
      [text]="true"
      ariaLabel="Predchádzajúci mesiac"
      (onClick)="changed.emit(shift(-1))"
    />
    <p-datepicker
      [ngModel]="month()"
      (ngModelChange)="pick($event)"
      view="month"
      dateFormat="MM yy"
      [maxDate]="today"
      [readonlyInput]="true"
      [showIcon]="true"
      iconDisplay="input"
      ariaLabel="Vybrať mesiac"
      inputStyleClass="month-input"
    />
    <p-button
      icon="pi pi-chevron-right"
      severity="secondary"
      [text]="true"
      ariaLabel="Nasledujúci mesiac"
      [disabled]="isCurrent()"
      (onClick)="changed.emit(shift(1))"
    />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--et-s1);
    }

    :host ::ng-deep .month-input {
      width: 10.5rem;
    }
  `,
})
export class MonthSwitcherComponent {
  readonly month = input.required<Date>();
  readonly changed = output<Date>();

  protected readonly today = new Date();
  protected readonly isCurrent = computed(() => isSameMonth(this.month(), new Date()));

  protected shift(delta: number): Date {
    return addMonths(this.month(), delta);
  }

  protected pick(month: Date | null): void {
    if (month) {
      this.changed.emit(month);
    }
  }
}
