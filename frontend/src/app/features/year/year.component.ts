import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { ChartType, TooltipItem } from 'chart.js';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';

import { ReportService } from '../../core/api/report.service';
import { Forecast } from '../../core/models';
import { plural } from '../../core/labels';
import { UNCATEGORISED_COLOR, chartPalette, chartTooltip } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

const YEARS_SHOWN = 3;

@Component({
  selector: 'app-year',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    ChartModule,
    SelectButtonModule,
    SkeletonModule,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header eyebrow="Celý rok" [heading]="selectedYear().toString()">
      <p-selectbutton
        [ngModel]="selectedYear()"
        (ngModelChange)="selectYear($event)"
        [options]="yearOptions"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        ariaLabelledBy="year-label"
      />
      <span id="year-label" class="sr-only">Rok</span>
    </app-page-header>

    @if (report.error() && !report.hasValue()) {
      <app-error-state [error]="report.error()" (retry)="report.reload()" />
    } @else if (!report.hasValue()) {
      <section class="forecast et-inset" aria-busy="true">
        <p-skeleton width="10rem" height="0.75rem" />
        <div class="figures skeleton-figures">
          @for (i of [0, 1, 2]; track i) {
            <p-skeleton height="3.5rem" />
          }
        </div>
      </section>
      <section class="charts">
        <div class="et-panel"><p-skeleton height="18rem" /></div>
        <div class="et-panel"><p-skeleton height="18rem" /></div>
      </section>
    } @else if (isEmpty()) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-chart-line"
          [heading]="'Za rok ' + selectedYear() + ' nemám žiadne pohyby'"
          message="Keď pribudnú transakcie, uvidíš tu mesiace vedľa seba a odhad na koniec roka."
        >
          <a pButton routerLink="/import"
            ><i class="pi pi-upload" aria-hidden="true"></i>Importovať výpis</a
          >
        </app-empty-state>
      </div>
    } @else {
      @if (forecast(); as f) {
        <section class="forecast et-inset">
          <div class="head">
            <p class="et-eyebrow">Odhad na koniec roka</p>
            <span class="basis">{{ basisLabel(f) }}</span>
          </div>

          <div class="figures">
            <div>
              <p class="et-eyebrow">Zarobíš</p>
              <p class="et-num big et-in">{{ f.projectedIncome | currency: 'EUR' }}</p>
              <p class="delta">
                zatiaľ <span class="et-num">{{ f.actualIncome | currency: 'EUR' }}</span
                >,&nbsp;
                <span
                  class="et-num"
                  [class.et-in]="f.incomeMonthlyChange >= 0"
                  [class.et-out]="f.incomeMonthlyChange < 0"
                >
                  {{ f.incomeMonthlyChange > 0 ? '+' : ''
                  }}{{ f.incomeMonthlyChange | number: '1.0-0' }} € / mes.
                </span>
              </p>
            </div>

            <div>
              <p class="et-eyebrow">Minieš</p>
              <p class="et-num big et-out">{{ f.projectedExpense | currency: 'EUR' }}</p>
              <p class="delta">
                zatiaľ <span class="et-num">{{ f.actualExpense | currency: 'EUR' }}</span
                >,&nbsp;
                <span
                  class="et-num"
                  [class.et-out]="f.expenseMonthlyChange > 0"
                  [class.et-in]="f.expenseMonthlyChange <= 0"
                >
                  {{ f.expenseMonthlyChange > 0 ? '+' : ''
                  }}{{ f.expenseMonthlyChange | number: '1.0-0' }} € / mes.
                </span>
              </p>
            </div>

            <div>
              <p class="et-eyebrow">{{ f.projectedBalance >= 0 ? 'Zostane ti' : 'Chýbať bude' }}</p>
              <p
                class="et-num big"
                [class.et-kept]="f.projectedBalance >= 0"
                [class.et-out]="f.projectedBalance < 0"
              >
                {{ abs(f.projectedBalance) | currency: 'EUR' }}
              </p>
              <p class="delta">
                zatiaľ <span class="et-num">{{ f.actualBalance | currency: 'EUR' }}</span>
              </p>
            </div>
          </div>

          @if (f.monthsUsed < 3) {
            <p class="warn">
              <i class="pi pi-info-circle" aria-hidden="true"></i>
              Odhad stojí len na {{ monthsLabel(f.monthsUsed) }}, ber ho preto s rezervou.
            </p>
          }
        </section>
      }

      <section class="charts">
        <div class="et-panel">
          <p class="et-eyebrow et-panel-head">Príjmy a výdavky po mesiacoch</p>
          <div class="chart">
            <p-chart
              type="bar"
              [data]="barData()"
              [options]="barOptions"
              height="100%"
              ariaLabel="Príjmy a výdavky po mesiacoch"
            />
          </div>
        </div>

        <div class="et-panel">
          <p class="et-eyebrow et-panel-head">Ako ti rástol zostatok</p>
          <div class="chart">
            <p-chart
              type="line"
              [data]="lineData()"
              [options]="lineOptions"
              height="100%"
              ariaLabel="Kumulatívny zostatok po mesiacoch"
            />
          </div>
        </div>
      </section>

      @if (forecast(); as f) {
        @if (f.categories.length) {
          <section class="et-panel">
            <p class="et-eyebrow et-panel-head">Odhad výdavkov podľa kategórie</p>

            <div class="rows-head" aria-hidden="true">
              <span></span>
              <span class="now">zatiaľ</span>
              <span class="end">do konca roka</span>
            </div>

            <ul class="rows">
              @for (row of f.categories; track row.categoryName) {
                <li>
                  <span class="et-dot" [style.background]="row.color ?? uncategorised"></span>
                  <span class="label et-truncate">{{ row.categoryName }}</span>
                  <span class="bar" aria-hidden="true">
                    <span
                      class="fill"
                      [style.width.%]="widthOf(row.projectedYearEnd)"
                      [style.background]="row.color ?? uncategorised"
                    ></span>
                  </span>
                  <span class="now et-num">
                    <span class="sr-only">zatiaľ minuté </span
                    >{{ row.actualToDate | currency: 'EUR' }}
                  </span>
                  <span class="end et-num">
                    <span class="sr-only">odhad do konca roka </span
                    >{{ row.projectedYearEnd | currency: 'EUR' }}
                  </span>
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styles: `
    .forecast {
      padding: 1.25rem var(--et-s5);
      margin-bottom: var(--et-s4);
    }

    .forecast .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--et-s2) var(--et-s4);
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }

    .forecast .head p {
      margin: 0;
    }

    .basis {
      font-size: 0.8125rem;
      color: var(--et-faint);
    }

    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(13rem, 100%), 1fr));
      gap: var(--et-s5);
    }

    .skeleton-figures {
      margin-top: 1.25rem;
    }

    .figures p {
      margin: 0;
    }

    .big {
      margin-top: 0.375rem !important;
      font-size: clamp(1.5rem, 4vw, 2rem);
      font-weight: 600;
      line-height: 1.1;
    }

    .delta {
      margin-top: 0.375rem !important;
      font-size: 0.8125rem;
      color: var(--et-faint);
    }

    .warn {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
      margin: 1.25rem 0 0;
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .warn i {
      color: var(--et-kept);
    }

    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
      gap: var(--et-s4);
      margin-bottom: var(--et-s4);
    }

    .chart {
      position: relative;
      height: 18rem;
    }

    .rows-head,
    .rows li {
      display: grid;
      grid-template-columns: 0.5rem minmax(6rem, 1fr) minmax(3rem, 2fr) 6.5rem 7rem;
      align-items: center;
      gap: var(--et-s3);
    }

    .rows-head {
      grid-template-columns: minmax(0, 1fr) 6.5rem 7rem;
      padding-bottom: var(--et-s2);
      border-bottom: 1px solid var(--et-surface-2);
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .rows li {
      padding: var(--et-s2) 0;
      font-size: 0.9375rem;
    }

    .bar {
      height: 0.375rem;
      border-radius: 999px;
      background: var(--et-surface-2);
      overflow: hidden;
    }

    .fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      opacity: 0.85;
    }

    .now {
      font-size: 0.8125rem;
      color: var(--et-faint);
      text-align: right;
    }

    .end {
      font-weight: 500;
      text-align: right;
    }

    .rows-head .end {
      font-weight: 400;
    }

    @media (max-width: 700px) {
      .rows li {
        grid-template-columns: 0.5rem minmax(0, 1fr) auto;
      }

      .rows-head {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .bar,
      .now {
        display: none;
      }

      .chart {
        height: 14rem;
      }
    }
  `,
})
export class YearComponent {
  private readonly reports = inject(ReportService);
  private readonly router = inject(Router);

  protected readonly uncategorised = UNCATEGORISED_COLOR;

  /** Bound from the `?year=` query param. */
  readonly year = input<string>();

  private readonly currentYear = new Date().getFullYear();

  protected readonly yearOptions = Array.from({ length: YEARS_SHOWN }, (_, i) => {
    const value = this.currentYear - (YEARS_SHOWN - 1) + i;
    return { label: String(value), value };
  });

  protected readonly selectedYear = computed(() => {
    const parsed = Number(this.year());
    return Number.isInteger(parsed) && parsed > 1900 ? parsed : this.currentYear;
  });

  protected readonly report = rxResource({
    params: () => this.selectedYear(),
    stream: ({ params: year }) =>
      forkJoin({ overview: this.reports.year(year), forecast: this.reports.forecast(year) }),
  });

  private readonly data = computed(() => (this.report.hasValue() ? this.report.value() : null));
  protected readonly forecast = computed(() => this.data()?.forecast ?? null);

  protected readonly isEmpty = computed(() => {
    const overview = this.data()?.overview;
    return !!overview && overview.totalIncome === 0 && overview.totalExpense === 0;
  });

  private readonly largestProjection = computed(() =>
    Math.max(...(this.forecast()?.categories ?? []).map((c) => c.projectedYearEnd), 1),
  );

  protected readonly barData = computed(() => {
    const months = this.data()?.overview.months ?? [];

    return {
      labels: months.map((month) => month.label),
      datasets: [
        {
          label: 'Príjmy',
          data: months.map((month) => month.income),
          backgroundColor: chartPalette.in,
          borderRadius: 3,
        },
        {
          label: 'Výdavky',
          data: months.map((month) => month.expense),
          backgroundColor: chartPalette.out,
          borderRadius: 3,
        },
      ],
    };
  });

  protected readonly lineData = computed(() => {
    const months = this.data()?.overview.months ?? [];
    // Months that have not happened yet would otherwise draw a flat line to December.
    const upTo = months.filter((month) => month.income > 0 || month.expense > 0).length;

    return {
      labels: months.slice(0, upTo).map((month) => month.label),
      datasets: [
        {
          label: 'Kumulatívny zostatok',
          data: months.slice(0, upTo).map((month) => month.cumulativeBalance),
          borderColor: chartPalette.kept,
          backgroundColor: chartPalette.keptFill,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: chartPalette.kept,
        },
      ],
    };
  });

  protected readonly barOptions = this.chartOptions();
  protected readonly lineOptions = this.chartOptions(false);

  protected selectYear(year: number | null): void {
    if (year === null) {
      return;
    }
    void this.router.navigate([], {
      queryParams: { year: year === this.currentYear ? null : year },
      queryParamsHandling: 'merge',
    });
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected widthOf(value: number): number {
    return (value / this.largestProjection()) * 100;
  }

  protected monthsLabel(count: number): string {
    return `${count} ${count === 1 ? 'mesiaci' : 'mesiacoch'}`;
  }

  protected basisLabel(forecast: Forecast): string {
    const n = forecast.monthsUsed;
    return `z ${n} ${n === 1 ? 'dokončeného mesiaca' : 'dokončených mesiacov'}`;
  }

  private chartOptions(showLegend = true) {
    const money = (value: number | string) =>
      Number(value).toLocaleString('sk-SK', { maximumFractionDigits: 0 }) + ' €';

    return {
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      plugins: {
        legend: {
          display: showLegend,
          position: 'bottom' as const,
          labels: { color: chartPalette.muted, boxWidth: 10, boxHeight: 10, usePointStyle: true },
        },
        tooltip: {
          ...chartTooltip,
          callbacks: {
            label: (item: TooltipItem<ChartType>) =>
              `${item.dataset.label ?? ''}: ${Number(item.raw).toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' })}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: chartPalette.faint },
          grid: { display: false },
          border: { color: chartPalette.line },
        },
        y: {
          ticks: { color: chartPalette.faint, callback: money },
          grid: { color: chartPalette.surface2 },
          border: { display: false },
        },
      },
    };
  }
}
