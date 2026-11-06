import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { ReportService } from '../../core/api/report.service';
import { RecurringPayment } from '../../core/models';
import { parseIsoDate, toIsoDate } from '../../core/date-utils';
import { plural } from '../../core/labels';
import { searchTermFor } from '../../core/search';
import { UNCATEGORISED_COLOR } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** "mesačne" reads better than "každých 30 dní" for the cadences people actually pay at. */
function cadenceLabel(days: number): string {
  if (days >= 6 && days <= 8) {
    return 'týždenne';
  }
  if (days >= 13 && days <= 16) {
    return 'každé 2 týždne';
  }
  if (days >= 26 && days <= 35) {
    return 'mesačne';
  }
  if (days >= 55 && days <= 66) {
    return 'každé 2 mesiace';
  }
  if (days >= 85 && days <= 95) {
    return 'štvrťročne';
  }
  if (days >= 175 && days <= 190) {
    return 'polročne';
  }
  if (days >= 350 && days <= 380) {
    return 'ročne';
  }
  return `každých ${days} ${plural(days, 'deň', 'dni', 'dní')}`;
}

@Component({
  selector: 'app-recurring',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ButtonModule,
    TableModule,
    TooltipModule,
    EmptyStateComponent,
    ErrorStateComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      eyebrow="Plánovanie"
      heading="Opakované platby"
      description="Predplatné, nájom, poistky a iné platby, ktoré sa ti pravidelne vracajú. Zistené z výdavkov za posledných 12 mesiacov."
    />

    @if (report.error()) {
      <app-error-state
        heading="Opakované platby sa nepodarilo načítať"
        [error]="report.error()"
        (retry)="report.reload()"
      />
    } @else if (!report.hasValue()) {
      <div class="et-panel"><app-list-skeleton [rows]="6" /></div>
    } @else if (!payments().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-replay"
          heading="Zatiaľ som nenašiel žiadne opakované platby"
          message="Platba sa tu objaví, keď ju uvidím aspoň v troch rôznych mesiacoch s podobnou sumou. Naimportuj výpisy za dlhšie obdobie."
        >
          <a pButton routerLink="/import"
            ><i class="pi pi-upload" aria-hidden="true"></i>Importovať výpis</a
          >
        </app-empty-state>
      </div>
    } @else {
      <section class="totals et-panel" aria-label="Súčet opakovaných platieb">
        <div>
          <p class="et-eyebrow">Ročne spolu</p>
          <p class="et-num big et-out">{{ yearlyTotal() | currency: 'EUR' }}</p>
        </div>
        <div>
          <p class="et-eyebrow">Mesačne v priemere</p>
          <p class="et-num mid et-out">{{ yearlyTotal() / 12 | currency: 'EUR' }}</p>
        </div>
        <div>
          <p class="et-eyebrow">Platieb</p>
          <p class="et-num mid">{{ payments().length }}</p>
        </div>
      </section>

      <div class="et-panel table-panel">
        <p-table [value]="payments()" size="small" class="et-stack-table">
          <ng-template #header>
            <tr>
              <th scope="col">Platba</th>
              <th scope="col" class="et-right">Priemerná suma</th>
              <th scope="col" class="col-cadence">Ako často</th>
              <th scope="col" class="et-right col-months">Mesiacov</th>
              <th scope="col" class="col-last">Naposledy</th>
              <th scope="col">Ďalšia asi</th>
              <th scope="col" class="et-right">Ročne</th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr [class.stale]="isStale(row)">
              <td class="c-label">
                @if (transactionsLink(row); as link) {
                  <a
                    class="label et-truncate"
                    routerLink="/transactions"
                    [queryParams]="link"
                    [title]="'Zobraziť transakcie: ' + row.label"
                    >{{ row.label }}</a
                  >
                } @else {
                  <span class="label et-truncate" [title]="row.label">{{ row.label }}</span>
                }
                <span class="cat et-truncate">
                  <span
                    class="et-dot"
                    [style.background]="row.categoryColor ?? uncategorised"
                  ></span>
                  {{ row.categoryName ?? 'Nezaradené' }}
                </span>
              </td>
              <td class="c-avg et-right et-num">
                {{ row.averageAmount | currency: 'EUR' }}
                <span class="cadence-inline et-faint">{{ cadence(row) }}</span>
              </td>
              <td class="col-cadence et-muted">{{ cadence(row) }}</td>
              <td class="col-months et-right et-num et-muted">
                <span [pTooltip]="occurrencesLabel(row)" tooltipPosition="top">{{
                  row.monthsSeen
                }}</span>
              </td>
              <td class="col-last et-num et-muted">{{ row.lastDate | date: 'dd.MM.yyyy' }}</td>
              <td class="c-next">
                <span class="next-label">ďalšia </span>
                <span class="et-num">{{ row.nextExpectedDate | date: 'dd.MM.yyyy' }}</span>
                @if (isStale(row)) {
                  <span class="stale-note">možno skončila</span>
                }
              </td>
              <td class="c-yearly et-right et-num et-out">
                {{ row.estimatedYearlyCost | currency: 'EUR' }}
                <span class="yearly-suffix et-faint">ročne</span>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <details class="how et-panel">
      <summary>Ako opakované platby hľadám</summary>
      <ul>
        <li>
          Prechádzam výdavky za posledných 12 mesiacov a zoskupujem ich podľa popisu. Ignorujem
          diakritiku, veľké písmená a čísla, takže „NETFLIX 1234“ a „Netflix 5678“ sú tá istá
          platba.
        </li>
        <li>Skupina sa počíta, ak sa objavila aspoň v 3 rôznych mesiacoch.</li>
        <li>
          Suma musí byť stabilná: kolíše najviac o štvrtinu okolo priemeru. Bežné nákupy v obchode
          tak medzi opakované platby nespadnú.
        </li>
        <li>V priemere najviac dve platby za mesiac.</li>
        <li>
          Ďalší termín je posledná platba plus typický odstup medzi platbami. Ak už uplynul, platba
          možno skončila. Ročná suma je priemerná platba krát počet platieb za rok.
        </li>
      </ul>
    </details>
  `,
  styles: `
    .totals {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: var(--et-s4) 2.5rem;
      margin-bottom: var(--et-s4);
    }

    .totals p {
      margin: 0;
    }

    .big {
      margin-top: var(--et-s1) !important;
      font-size: clamp(1.75rem, 5vw, 2.25rem);
      font-weight: 600;
      line-height: 1.1;
    }

    .mid {
      margin-top: var(--et-s1) !important;
      font-size: 1.125rem;
      font-weight: 500;
    }

    .table-panel {
      padding: var(--et-s2) var(--et-s3);
    }

    .c-label {
      max-width: 22rem;
    }

    .label {
      display: block;
      font-weight: 500;
    }

    a.label {
      color: inherit;
      text-decoration: none;
    }

    a.label:hover,
    a.label:focus-visible {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .cat {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
      margin-top: 0.125rem;
      font-size: 0.8125rem;
      color: var(--et-muted);
    }

    .col-cadence,
    .c-next,
    .col-last {
      white-space: nowrap;
    }

    .c-yearly {
      font-weight: 600;
    }

    .cadence-inline,
    .next-label,
    .yearly-suffix {
      display: none;
    }

    .stale-note {
      display: block;
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    tr.stale .c-next .et-num {
      color: var(--et-faint);
      text-decoration: line-through;
    }

    .how {
      margin-top: var(--et-s4);
      padding: var(--et-s4) var(--et-s5);
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .how summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--et-text);
    }

    .how ul {
      margin: var(--et-s3) 0 0;
      padding-left: 1.25rem;
      line-height: 1.6;
    }

    .how li + li {
      margin-top: var(--et-s1);
    }

    @media (max-width: 1100px) {
      .col-months,
      .col-last {
        display: none !important;
      }
    }

    @media (max-width: 900px) {
      .col-cadence {
        display: none !important;
      }

      .cadence-inline {
        display: block;
        font-size: 0.75rem;
      }
    }

    /* Phones: each payment becomes a two-line card. */
    @media (max-width: 720px) {
      .table-panel {
        padding: 0 var(--et-s2);
      }

      tr {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'label yearly'
          'next avg';
      }

      .c-label {
        grid-area: label;
        max-width: none;
        min-width: 0;
      }

      .c-yearly {
        grid-area: yearly;
        align-self: start;
      }

      .yearly-suffix {
        display: block;
        font-size: 0.75rem;
        font-weight: 400;
      }

      .c-next {
        grid-area: next;
        font-size: 0.8125rem;
        color: var(--et-muted);
      }

      .next-label {
        display: inline;
      }

      .c-avg {
        grid-area: avg;
        font-size: 0.8125rem;
        color: var(--et-muted);
      }

      .cadence-inline {
        display: inline;
      }

      .how {
        padding: var(--et-s4);
      }
    }
  `,
})
export class RecurringComponent {
  private readonly reports = inject(ReportService);

  protected readonly uncategorised = UNCATEGORISED_COLOR;
  private readonly today = toIsoDate(new Date());

  protected readonly report = rxResource({ stream: () => this.reports.recurring() });

  /** The API already sorts by yearly cost; sorting again keeps that promise local. */
  protected readonly payments = computed(() =>
    this.report.hasValue()
      ? [...this.report.value().payments].sort(
          (a, b) => b.estimatedYearlyCost - a.estimatedYearlyCost,
        )
      : [],
  );

  protected readonly yearlyTotal = computed(() =>
    this.payments().reduce((sum, payment) => sum + payment.estimatedYearlyCost, 0),
  );

  protected cadence(row: RecurringPayment): string {
    return cadenceLabel(row.intervalDays);
  }

  /** All-time expenses matching the payment's most distinctive word; null if it has none. */
  protected transactionsLink(row: RecurringPayment): Record<string, string> | null {
    const q = searchTermFor(row.label);
    return q ? { q, type: 'EXPENSE', all: '1' } : null;
  }

  protected occurrencesLabel(row: RecurringPayment): string {
    const n = row.occurrences;
    return `${n} ${plural(n, 'platba', 'platby', 'platieb')} v ${row.monthsSeen} ${plural(row.monthsSeen, 'mesiaci', 'mesiacoch', 'mesiacoch')}`;
  }

  /** A next date well in the past (a week of slack) means the payment probably stopped. */
  protected isStale(row: RecurringPayment): boolean {
    const next = parseIsoDate(row.nextExpectedDate);
    if (!next) {
      return false;
    }
    const slack = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 7);
    return toIsoDate(slack) < this.today;
  }
}
