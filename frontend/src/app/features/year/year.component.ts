import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ReportService } from '../../core/api/report.service';
import { Forecast, YearOverview } from '../../core/models';
import { chartPalette } from '../../theme';

@Component({
  selector: 'app-year',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, ChartModule, SelectButtonModule],
  template: `
    <header class="page-head">
      <div>
        <p class="et-eyebrow">Celý rok</p>
        <h1>{{ selectedYear() }}</h1>
      </div>

      <p-selectbutton
        [(ngModel)]="year"
        [options]="yearOptions()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
      />
    </header>

    @if (forecast(); as f) {
      <section class="forecast et-inset">
        <div class="head">
          <p class="et-eyebrow">Odhad na koniec roka</p>
          <span class="basis">
            z {{ f.monthsUsed }}
            {{ f.monthsUsed === 1 ? 'dokončeného mesiaca' : f.monthsUsed < 5 ? 'dokončených mesiacov' : 'dokončených mesiacov' }}
          </span>
        </div>

        <div class="figures">
          <div>
            <p class="et-eyebrow">Zarobíš</p>
            <p class="et-num big et-in">{{ f.projectedIncome | currency: 'EUR' }}</p>
            <p class="delta">
              zatiaľ {{ f.actualIncome | currency: 'EUR' }} ·
              <span [class.et-in]="f.incomeMonthlyChange >= 0" [class.et-out]="f.incomeMonthlyChange < 0">
                {{ f.incomeMonthlyChange > 0 ? '+' : '' }}{{ f.incomeMonthlyChange | number: '1.0-0' }} € / mes.
              </span>
            </p>
          </div>

          <div>
            <p class="et-eyebrow">Minieš</p>
            <p class="et-num big et-out">{{ f.projectedExpense | currency: 'EUR' }}</p>
            <p class="delta">
              zatiaľ {{ f.actualExpense | currency: 'EUR' }} ·
              <span [class.et-out]="f.expenseMonthlyChange > 0" [class.et-in]="f.expenseMonthlyChange <= 0">
                {{ f.expenseMonthlyChange > 0 ? '+' : '' }}{{ f.expenseMonthlyChange | number: '1.0-0' }} € / mes.
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
            <p class="delta">zatiaľ {{ f.actualBalance | currency: 'EUR' }}</p>
          </div>
        </div>

        @if (f.monthsUsed < 3) {
          <p class="warn">
            Odhad stojí len na {{ f.monthsUsed }} mesiacoch, takže ním zatiaľ nešpekuluj.
          </p>
        }
      </section>
    }

    <section class="charts">
      <div class="panel">
        <p class="et-eyebrow panel-head">Príjmy a výdavky po mesiacoch</p>
        <p-chart type="bar" [data]="barData()" [options]="barOptions" height="18rem" />
      </div>

      <div class="panel">
        <p class="et-eyebrow panel-head">Ako ti rástol zostatok</p>
        <p-chart type="line" [data]="lineData()" [options]="lineOptions" height="18rem" />
      </div>
    </section>

    @if (forecast(); as f) {
      @if (f.categories.length) {
        <section class="panel">
          <p class="et-eyebrow panel-head">Odhad výdavkov podľa kategórie</p>

          <ul class="rows">
            @for (row of f.categories; track row.categoryName) {
              <li>
                <span class="dot" [style.background]="row.color ?? uncategorised"></span>
                <span class="label">{{ row.categoryName }}</span>
                <span class="bar">
                  <span
                    class="fill"
                    [style.width.%]="widthOf(row.projectedYearEnd, f)"
                    [style.background]="row.color ?? uncategorised"
                  ></span>
                </span>
                <span class="now et-num">{{ row.actualToDate | currency: 'EUR' }}</span>
                <span class="end et-num">{{ row.projectedYearEnd | currency: 'EUR' }}</span>
              </li>
            }
          </ul>

          <div class="legend">
            <span>zatiaľ minuté</span>
            <span>odhad do konca roka</span>
          </div>
        </section>
      }
    }
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
    }

    .panel {
      padding: 1.25rem 1.5rem;
      border: 1px solid var(--et-line);
      border-radius: 0.75rem;
      background: var(--et-surface);
      margin-bottom: 1rem;
    }

    .forecast {
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
    }

    .forecast .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .basis {
      font-size: 0.8125rem;
      color: var(--et-faint);
    }

    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 1.5rem;
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
      margin: 1.25rem 0 0;
      font-size: 0.875rem;
      color: var(--et-out);
    }

    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
      gap: 1rem;
    }

    .panel-head {
      margin: 0 0 1rem;
    }

    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .rows li {
      display: grid;
      grid-template-columns: 0.5rem minmax(7rem, 1fr) minmax(4rem, 2fr) auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      font-size: 0.9375rem;
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
      min-width: 5rem;
    }

    .end {
      font-weight: 500;
      text-align: right;
      min-width: 6rem;
    }

    .legend {
      display: flex;
      justify-content: flex-end;
      gap: 1.5rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    @media (max-width: 700px) {
      .rows li {
        grid-template-columns: 0.5rem 1fr auto;
      }

      .bar,
      .now {
        display: none;
      }
    }
  `,
})
export class YearComponent {
  private readonly reports = inject(ReportService);

  protected readonly uncategorised = chartPalette.faint;

  protected readonly year = signal(new Date().getFullYear());
  protected readonly selectedYear = this.year.asReadonly();
  protected readonly overview = signal<YearOverview | null>(null);
  protected readonly forecast = signal<Forecast | null>(null);

  protected readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current].map((value) => ({ label: String(value), value }));
  });

  protected readonly barData = computed(() => {
    const months = this.overview()?.months ?? [];

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
    const months = this.overview()?.months ?? [];
    // Months that have not happened yet would otherwise draw a flat line to December.
    const upTo = months.filter((month) => month.income > 0 || month.expense > 0).length;

    return {
      labels: months.slice(0, upTo).map((month) => month.label),
      datasets: [
        {
          label: 'Kumulatívny zostatok',
          data: months.slice(0, upTo).map((month) => month.cumulativeBalance),
          borderColor: chartPalette.kept,
          backgroundColor: 'rgba(232, 167, 44, 0.12)',
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

  constructor() {
    effect(() => {
      const year = this.year();
      this.reports.year(year).subscribe((overview) => this.overview.set(overview));
      this.reports.forecast(year).subscribe((forecast) => this.forecast.set(forecast));
    });
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected widthOf(value: number, forecast: Forecast): number {
    const largest = Math.max(...forecast.categories.map((category) => category.projectedYearEnd), 1);
    return (value / largest) * 100;
  }

  private chartOptions(showLegend = true) {
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
          backgroundColor: chartPalette.surface2,
          borderColor: chartPalette.line,
          borderWidth: 1,
          titleColor: chartPalette.text,
          bodyColor: chartPalette.muted,
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: chartPalette.faint },
          grid: { display: false },
          border: { color: chartPalette.line },
        },
        y: {
          ticks: { color: chartPalette.faint },
          grid: { color: chartPalette.surface2 },
          border: { display: false },
        },
      },
    };
  }
}
