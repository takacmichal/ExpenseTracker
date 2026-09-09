import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';

import { ReportService } from '../../core/api/report.service';
import { CategoryTotal, MonthlySummary } from '../../core/models';
import { chartPalette } from '../../theme';

interface Segment {
  label: string;
  amount: number;
  share: number;
  color: string;
}

const UNCATEGORISED = chartPalette.faint;

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, ChartModule, DatePickerModule],
  template: `
    <header class="page-head">
      <div>
        <p class="et-eyebrow">Prehľad</p>
        <h1>{{ monthLabel() }}</h1>
      </div>

      <p-datepicker
        [(ngModel)]="selectedMonth"
        view="month"
        dateFormat="MM yy"
        [showIcon]="true"
        [readonlyInput]="true"
        iconDisplay="input"
      />
    </header>

    <section class="hero et-inset">
      <div class="figures">
        <div class="kept">
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

      @if (base() > 0) {
        <div class="meter" role="img" [attr.aria-label]="barSummary()">
          @for (segment of segments(); track segment.label) {
            <span
              class="seg"
              [style.width.%]="segment.share"
              [style.background]="segment.color"
              [title]="segment.label + ' · ' + (segment.amount | currency: 'EUR')"
            ></span>
          }
          @if (keptShare() > 0) {
            <span
              class="seg kept-seg"
              [style.width.%]="keptShare()"
              [title]="'Zostalo · ' + (balance() | currency: 'EUR')"
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
        <div class="empty-hero">
          <p>Za {{ monthLabel() }} tu zatiaľ nič nie je.</p>
          <p class="hint">Pridaj transakciu alebo naimportuj výpis z banky.</p>
        </div>
      }
    </section>

    <section class="breakdown">
      <div class="panel">
        <p class="et-eyebrow panel-head">Na čo išli výdavky</p>

        @if (expenseTotals().length) {
          <div class="ring">
            <p-chart type="doughnut" [data]="ringData()" [options]="ringOptions" />
            <div class="ring-center">
              <span class="et-eyebrow">Spolu</span>
              <span class="et-num et-out">{{ expense() | currency: 'EUR' }}</span>
            </div>
          </div>
        } @else {
          <p class="muted">Žiadne výdavky.</p>
        }
      </div>

      <div class="panel">
        <p class="et-eyebrow panel-head">Podľa kategórie</p>

        @if (expenseTotals().length) {
          <ul class="rows">
            @for (row of expenseTotals(); track row.categoryName) {
              <li>
                <span class="dot" [style.background]="row.color ?? uncategorised"></span>
                <span class="label">{{ row.categoryName ?? 'Nezaradené' }}</span>
                <span class="count et-num">{{ row.transactionCount }}×</span>
                <span class="amount et-num">{{ row.total | currency: 'EUR' }}</span>
                <span class="share et-num">{{ shareOf(row) | number: '1.0-0' }} %</span>
              </li>
            }
          </ul>
        } @else {
          <p class="muted">Žiadne dáta.</p>
        }
      </div>
    </section>
  `,
  styles: `
    .page-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    h1 {
      margin: 0.25rem 0 0;
      font-size: 1.75rem;
      text-transform: capitalize;
    }

    .hero {
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .figures {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 2rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .big {
      margin: 0.375rem 0 0;
      font-size: clamp(2.25rem, 6vw, 3.25rem);
      font-weight: 600;
      line-height: 1;
    }

    .mid {
      margin: 0.25rem 0 0;
      font-size: 1.125rem;
      font-weight: 500;
    }

    .side {
      display: flex;
      gap: 2.5rem;
    }

    .kept p,
    .side p {
      margin: 0;
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

    .empty-hero {
      padding: 1rem 0 0.25rem;
    }

    .empty-hero p {
      margin: 0;
    }

    .hint {
      margin-top: 0.25rem !important;
      font-size: 0.875rem;
      color: var(--et-faint);
    }

    .breakdown {
      display: grid;
      grid-template-columns: minmax(15rem, 22rem) 1fr;
      gap: 1rem;
      align-items: start;
    }

    .panel {
      padding: 1.25rem;
      border: 1px solid var(--et-line);
      border-radius: 0.75rem;
      background: var(--et-surface);
    }

    .panel-head {
      margin: 0 0 1rem;
    }

    .ring {
      position: relative;
      display: grid;
      place-items: center;
    }

    .ring-center {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.125rem;
      pointer-events: none;
    }

    .ring-center span:last-child {
      font-size: 1.0625rem;
      font-weight: 600;
    }

    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .rows li {
      display: grid;
      grid-template-columns: 0.5rem 1fr auto auto 3rem;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid var(--et-surface-2);
      font-size: 0.9375rem;
    }

    .rows li:last-child {
      border-bottom: none;
    }

    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .count {
      font-size: 0.8125rem;
      color: var(--et-faint);
    }

    .amount {
      font-weight: 500;
    }

    .share {
      text-align: right;
      font-size: 0.8125rem;
      color: var(--et-muted);
    }

    .muted {
      margin: 0;
      color: var(--et-faint);
      font-size: 0.9375rem;
    }

    @media (max-width: 820px) {
      .breakdown {
        grid-template-columns: 1fr;
      }

      .side {
        gap: 1.5rem;
      }
    }
  `,
})
export class DashboardComponent {
  private readonly reports = inject(ReportService);

  protected readonly uncategorised = UNCATEGORISED;

  protected readonly selectedMonth = signal(new Date());
  protected readonly summary = signal<MonthlySummary | null>(null);
  protected readonly categoryTotals = signal<CategoryTotal[]>([]);

  protected readonly income = computed(() => this.summary()?.totalIncome ?? 0);
  protected readonly expense = computed(() => this.summary()?.totalExpense ?? 0);
  protected readonly balance = computed(() => this.summary()?.balance ?? 0);
  protected readonly absBalance = computed(() => Math.abs(this.balance()));

  protected readonly expenseTotals = computed(() =>
    this.categoryTotals()
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
      color: total.color ?? UNCATEGORISED,
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

  protected readonly ringData = computed(() => {
    const totals = this.expenseTotals();

    return {
      labels: totals.map((total) => total.categoryName ?? 'Nezaradené'),
      datasets: [
        {
          data: totals.map((total) => total.total),
          backgroundColor: totals.map((total) => total.color ?? UNCATEGORISED),
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
      tooltip: {
        backgroundColor: chartPalette.surface2,
        borderColor: chartPalette.line,
        borderWidth: 1,
        titleColor: chartPalette.text,
        bodyColor: chartPalette.muted,
        padding: 10,
        displayColors: false,
      },
    },
  };

  constructor() {
    effect(() => {
      const month = this.selectedMonth();
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const from = `${monthKey}-01`;
      const to = this.lastDayOfMonth(month);

      this.reports.summary(monthKey).subscribe((summary) => this.summary.set(summary));
      this.reports
        .byCategory(from, to)
        .subscribe((breakdown) => this.categoryTotals.set(breakdown.categories));
    });
  }

  protected shareOf(row: CategoryTotal): number {
    const expense = this.expense();
    return expense > 0 ? (row.total / expense) * 100 : 0;
  }

  protected barSummary(): string {
    return `Prišlo ${this.income()} €, odišlo ${this.expense()} €, zostalo ${this.balance()} €`;
  }

  private lastDayOfMonth(month: Date): string {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  }
}
