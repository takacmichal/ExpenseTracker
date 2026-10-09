import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';

import { BudgetService } from '../../core/api/budget.service';
import { ReportService } from '../../core/api/report.service';
import { CategoryTotal } from '../../core/models';
import { addMonths, isSameMonth, monthRange, toMonthKey } from '../../core/date-utils';
import { plural } from '../../core/labels';
import { UNCATEGORISED_COLOR, chartPalette, chartTooltip } from '../../theme';
import { BudgetMeterComponent } from '../../shared/budget-meter.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface Segment {
  label: string;
  amount: number;
  share: number;
  color: string;
}

/** Parses the `?month=YYYY-MM` query param; anything else means the current month. */
function parseMonth(value: string | undefined): Date {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const now = new Date();
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : now;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    ChartModule,
    DatePickerModule,
    SkeletonModule,
    BudgetMeterComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header eyebrow="Prehľad" [heading]="monthLabel()">
      <div class="month-nav">
        <p-button
          icon="pi pi-chevron-left"
          severity="secondary"
          [text]="true"
          ariaLabel="Predchádzajúci mesiac"
          (onClick)="shiftMonth(-1)"
        />
        <p-datepicker
          [ngModel]="selectedMonth()"
          (ngModelChange)="selectMonth($event)"
          view="month"
          dateFormat="MM yy"
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
          [disabled]="isCurrentMonth()"
          (onClick)="shiftMonth(1)"
        />
      </div>
    </app-page-header>

    @if (report.error() && !report.hasValue()) {
      <app-error-state [error]="report.error()" (retry)="report.reload()" />
    } @else {
      <section class="hero et-inset" [attr.aria-busy]="report.isLoading()">
        @if (!report.hasValue()) {
          <div class="figures">
            <div>
              <p-skeleton width="5rem" height="0.75rem" />
              <p-skeleton width="14rem" height="3rem" class="gap-top" />
            </div>
            <div class="side">
              <p-skeleton width="7rem" height="2.5rem" />
              <p-skeleton width="7rem" height="2.5rem" />
            </div>
          </div>
          <p-skeleton height="0.625rem" />
        } @else if (base() > 0) {
          <div class="figures">
            <div>
              <p class="et-eyebrow">{{ balance() >= 0 ? 'Zostalo' : 'Prekročené o' }}</p>
              <p class="et-num big" [class.et-kept]="balance() >= 0" [class.et-out]="balance() < 0">
                {{ absBalance() | currency: 'EUR' }}
              </p>
            </div>

            <div class="side">
              <div>
                <p class="et-eyebrow">Prišlo</p>
                <p class="et-num mid et-in">{{ income() | currency: 'EUR' }}</p>
              </div>
              <div>
                <p class="et-eyebrow">Odišlo</p>
                <p class="et-num mid et-out">{{ expense() | currency: 'EUR' }}</p>
              </div>
            </div>
          </div>

          <div class="meter" role="img" [attr.aria-label]="barSummary()">
            @for (segment of segments(); track segment.label) {
              <span
                class="seg"
                [style.width.%]="segment.share"
                [style.background]="segment.color"
                [title]="segment.label + ': ' + (segment.amount | currency: 'EUR')"
              ></span>
            }
            @if (keptShare() > 0) {
              <span
                class="seg kept-seg"
                [style.width.%]="keptShare()"
                [title]="'Zostalo: ' + (balance() | currency: 'EUR')"
              ></span>
            }
          </div>

          <p class="bar-note">
            @if (balance() >= 0 && income() > 0) {
              Z každého eura, ktoré prišlo, ti zostalo
              <strong class="et-num et-kept">{{ keptRatio() | number: '1.0-0' }} centov</strong>.
            } @else if (income() > 0) {
              Minul si o
              <strong class="et-num et-out">{{ overRatio() | number: '1.0-0' }} %</strong>
              viac, než prišlo.
            } @else {
              Za tento mesiac zatiaľ neevidujem žiadny príjem.
            }
          </p>
        } @else {
          <app-empty-state
            class="compact"
            icon="pi pi-wallet"
            [heading]="'Za ' + monthLabel() + ' tu zatiaľ nič nie je'"
            message="Pridaj transakciu ručne alebo naimportuj výpis z banky."
          >
            <a pButton routerLink="/transactions" [queryParams]="{ add: 1 }"
              ><i class="pi pi-plus" aria-hidden="true"></i>Pridať transakciu</a
            >
            <a pButton routerLink="/import" severity="secondary" [outlined]="true"
              ><i class="pi pi-upload" aria-hidden="true"></i>Importovať výpis</a
            >
          </app-empty-state>
        }
      </section>

      @if (topBudgets().length) {
        <section class="et-panel budgets" aria-labelledby="budgets-head">
          <div class="budgets-head">
            <h2 id="budgets-head" class="et-eyebrow">Rozpočty</h2>
            <a routerLink="/budgets" [queryParams]="budgetsLink()" class="all-link">
              Všetky rozpočty <i class="pi pi-arrow-right" aria-hidden="true"></i>
            </a>
          </div>
          <div class="budget-list">
            @for (budget of topBudgets(); track budget.budgetId) {
              <app-budget-meter [status]="budget" [compact]="true" />
            }
          </div>
        </section>
      } @else if (budgetStatus.error()) {
        <p class="budgets-error et-faint" role="status">
          Rozpočty sa nepodarilo načítať.
          <button type="button" class="retry" (click)="budgetStatus.reload()">Skúsiť znova</button>
        </p>
      }

      @if (!report.hasValue() || expenseTotals().length) {
        <section class="breakdown">
          <div class="et-panel">
            <p class="et-eyebrow et-panel-head">Na čo išli výdavky</p>

            @if (!report.hasValue()) {
              <div class="ring-skeleton"><p-skeleton shape="circle" size="12rem" /></div>
            } @else {
              <div class="ring">
                <p-chart
                  type="doughnut"
                  [data]="ringData()"
                  [options]="ringOptions"
                  ariaLabel="Výdavky podľa kategórie"
                />
                <div class="ring-center">
                  <span class="et-eyebrow">Spolu</span>
                  <span class="et-num et-out">{{ expense() | currency: 'EUR' }}</span>
                </div>
              </div>
            }
          </div>

          <div class="et-panel">
            <p class="et-eyebrow et-panel-head">Podľa kategórie</p>

            @if (!report.hasValue()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <p-skeleton height="1.25rem" class="row-skeleton" />
              }
            } @else {
              <ul class="rows">
                @for (row of expenseTotals(); track row.categoryId ?? row.categoryName) {
                  <li>
                    <span class="et-dot" [style.background]="row.color ?? uncategorised"></span>
                    @if (row.categoryId) {
                      <a
                        class="label et-truncate"
                        routerLink="/transactions"
                        [queryParams]="transactionsLink(row)"
                        >{{ row.categoryName }}</a
                      >
                    } @else {
                      <span class="label et-truncate">{{ row.categoryName ?? 'Nezaradené' }}</span>
                    }
                    <span class="count et-num" [title]="countTitle(row)"
                      >{{ row.transactionCount }}×</span
                    >
                    <span class="amount et-num">{{ row.total | currency: 'EUR' }}</span>
                    <span class="share et-num">{{ shareOf(row) | number: '1.0-0' }} %</span>
                  </li>
                }
              </ul>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    .month-nav {
      display: flex;
      align-items: center;
      gap: var(--et-s1);
    }

    :host ::ng-deep .month-input {
      width: 10.5rem;
    }

    .hero {
      padding: var(--et-s5);
      margin-bottom: var(--et-s4);
    }

    .figures {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--et-s5) var(--et-s6);
      flex-wrap: wrap;
      margin-bottom: var(--et-s5);
    }

    .figures p {
      margin: 0;
    }

    :host ::ng-deep .gap-top {
      margin-top: var(--et-s2);
    }

    .big {
      margin-top: 0.375rem !important;
      font-size: clamp(2.25rem, 6vw, 3.25rem);
      font-weight: 600;
      line-height: 1;
    }

    .mid {
      margin-top: var(--et-s1) !important;
      font-size: 1.125rem;
      font-weight: 500;
    }

    .side {
      display: flex;
      gap: 2.5rem;
    }

    /* The signature: one month of money, left to right, read like a bargraph. */
    .meter {
      position: relative;
      display: flex;
      height: 0.625rem;
      border-radius: 2px;
      overflow: hidden;
      background: var(--et-surface-2);
    }

    /* Notches are painted over the fill, so the segments cost no extra elements. */
    .meter::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: repeating-linear-gradient(
        90deg,
        transparent 0 5px,
        var(--et-inset) 5px 7px
      );
      pointer-events: none;
    }

    .seg {
      transition: filter 0.15s;
    }

    .seg:hover {
      filter: brightness(1.25);
    }

    .kept-seg {
      background: var(--et-kept);
    }

    .bar-note {
      margin: 0.875rem 0 0;
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .budgets {
      margin-bottom: var(--et-s4);
      padding: 1.25rem var(--et-s5);
    }

    .budgets-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--et-s3);
      margin-bottom: var(--et-s4);
    }

    .budgets-head h2 {
      margin: 0;
    }

    .all-link {
      font-size: 0.8125rem;
      text-decoration: none;
      white-space: nowrap;
    }

    .all-link:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .all-link i {
      font-size: 0.6875rem;
    }

    .budget-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
      gap: var(--et-s4) var(--et-s5);
    }

    .budgets-error {
      margin: 0 0 var(--et-s4);
      font-size: 0.8125rem;
    }

    .retry {
      padding: 0;
      border: 0;
      background: none;
      color: var(--et-kept);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }

    .breakdown {
      display: grid;
      grid-template-columns: minmax(15rem, 22rem) minmax(0, 1fr);
      gap: var(--et-s4);
      align-items: start;
    }

    .ring,
    .ring-skeleton {
      position: relative;
      max-width: 18rem;
      margin: 0 auto;
    }

    .ring-skeleton {
      display: grid;
      place-items: center;
    }

    .ring p-chart {
      display: block;
      width: 100%;
    }

    .ring-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.125rem;
      pointer-events: none;
    }

    .ring-center span:last-child {
      font-size: 1.0625rem;
      font-weight: 600;
    }

    :host ::ng-deep .row-skeleton {
      margin: 0.625rem 0;
    }

    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .rows li {
      display: grid;
      grid-template-columns: 0.5rem minmax(0, 1fr) auto auto 3rem;
      align-items: center;
      gap: var(--et-s3);
      padding: 0.625rem 0;
      border-bottom: 1px solid var(--et-surface-2);
      font-size: 0.9375rem;
    }

    .rows li:last-child {
      border-bottom: none;
    }

    a.label {
      color: inherit;
      text-decoration: none;
    }

    a.label:hover {
      color: var(--et-kept);
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .count {
      font-size: 0.8125rem;
      color: var(--et-faint);
    }

    .amount {
      font-weight: 500;
      text-align: right;
    }

    .share {
      text-align: right;
      font-size: 0.8125rem;
      color: var(--et-muted);
    }

    @media (max-width: 820px) {
      .breakdown {
        grid-template-columns: minmax(0, 1fr);
      }

      .side {
        gap: var(--et-s5);
      }
    }

    @media (max-width: 480px) {
      .hero {
        padding: 1.25rem var(--et-s4);
      }

      .rows li {
        grid-template-columns: 0.5rem minmax(0, 1fr) auto 2.75rem;
        gap: var(--et-s2);
      }

      .count {
        display: none;
      }

      .ring,
      .ring-skeleton {
        max-width: 13rem;
      }
    }
  `,
})
export class DashboardComponent {
  private readonly reports = inject(ReportService);
  private readonly budgetService = inject(BudgetService);
  private readonly router = inject(Router);

  protected readonly uncategorised = UNCATEGORISED_COLOR;

  /** Bound from the `?month=YYYY-MM` query param, so the month survives reload and back. */
  readonly month = input<string>();

  protected readonly selectedMonth = computed(() => parseMonth(this.month()));
  protected readonly isCurrentMonth = computed(() => isSameMonth(this.selectedMonth(), new Date()));

  protected readonly report = rxResource({
    params: () => this.selectedMonth(),
    stream: ({ params: month }) => {
      const { from, to } = monthRange(month);
      return forkJoin({
        summary: this.reports.summary(toMonthKey(month)),
        breakdown: this.reports.byCategory(from, to),
      });
    },
  });

  /** Budget gauges for the same month; the widget stays hidden when there are none. */
  protected readonly budgetStatus = rxResource({
    params: () => this.selectedMonth(),
    stream: ({ params: month }) =>
      this.budgetService.status(month.getFullYear(), month.getMonth() + 1),
  });

  /** The few budgets closest to (or past) their limit. */
  protected readonly topBudgets = computed(() =>
    this.budgetStatus.hasValue()
      ? [...this.budgetStatus.value().budgets]
          .sort((a, b) => b.percentUsed - a.percentUsed)
          .slice(0, 4)
      : [],
  );

  protected readonly budgetsLink = computed(() =>
    this.isCurrentMonth() ? {} : { month: toMonthKey(this.selectedMonth()) },
  );

  private readonly data = computed(() => (this.report.hasValue() ? this.report.value() : null));

  protected readonly income = computed(() => this.data()?.summary.totalIncome ?? 0);
  protected readonly expense = computed(() => this.data()?.summary.totalExpense ?? 0);
  protected readonly balance = computed(() => this.data()?.summary.balance ?? 0);
  protected readonly absBalance = computed(() => Math.abs(this.balance()));

  protected readonly expenseTotals = computed(() =>
    (this.data()?.breakdown.categories ?? [])
      .filter((total) => total.type === 'EXPENSE')
      .sort((a, b) => b.total - a.total),
  );

  /** The bar is scaled to whichever is larger, so overspending visibly fills it. */
  protected readonly base = computed(() => Math.max(this.income(), this.expense()));

  protected readonly segments = computed<Segment[]>(() => {
    const base = this.base();
    if (base <= 0) {
      return [];
    }

    return this.expenseTotals().map((total) => ({
      label: total.categoryName ?? 'Nezaradené',
      amount: total.total,
      share: (total.total / base) * 100,
      color: total.color ?? UNCATEGORISED_COLOR,
    }));
  });

  protected readonly keptShare = computed(() => {
    const base = this.base();
    return base > 0 && this.balance() > 0 ? (this.balance() / base) * 100 : 0;
  });

  protected readonly keptRatio = computed(() =>
    this.income() > 0 ? (this.balance() / this.income()) * 100 : 0,
  );

  protected readonly overRatio = computed(() =>
    this.income() > 0 ? ((this.expense() - this.income()) / this.income()) * 100 : 0,
  );

  protected readonly monthLabel = computed(() =>
    this.selectedMonth().toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }),
  );

  protected readonly barSummary = computed(() => {
    const format = (value: number) =>
      value.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
    return `Prišlo ${format(this.income())}, odišlo ${format(this.expense())}, zostalo ${format(this.balance())}`;
  });

  protected readonly ringData = computed(() => {
    const totals = this.expenseTotals();

    return {
      labels: totals.map((total) => total.categoryName ?? 'Nezaradené'),
      datasets: [
        {
          data: totals.map((total) => total.total),
          backgroundColor: totals.map((total) => total.color ?? UNCATEGORISED_COLOR),
          borderColor: chartPalette.surface,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    };
  });

  protected readonly ringOptions = {
    cutout: '78%',
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: { ...chartTooltip, displayColors: false },
    },
  };

  protected selectMonth(month: Date | null): void {
    if (month) {
      this.navigateTo(month);
    }
  }

  protected shiftMonth(delta: number): void {
    this.navigateTo(addMonths(this.selectedMonth(), delta));
  }

  protected shareOf(row: CategoryTotal): number {
    const expense = this.expense();
    return expense > 0 ? (row.total / expense) * 100 : 0;
  }

  protected countTitle(row: CategoryTotal): string {
    const n = row.transactionCount;
    return `${n} ${plural(n, 'transakcia', 'transakcie', 'transakcií')}`;
  }

  protected transactionsLink(row: CategoryTotal): Record<string, string> {
    const { from, to } = monthRange(this.selectedMonth());
    return { from, to, category: row.categoryId ?? '', type: 'EXPENSE' };
  }

  private navigateTo(month: Date): void {
    const isCurrent = isSameMonth(month, new Date());
    void this.router.navigate([], {
      queryParams: { month: isCurrent ? null : toMonthKey(month) },
      queryParamsHandling: 'merge',
    });
  }
}
