import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { IncomeService } from '../../core/api/income.service';
import { Income, IncomePayload } from '../../core/models';
import { parseIsoDate, toIsoDate } from '../../core/date-utils';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** Gross pay can be left out, but when given it cannot be below the net amount. */
function grossNotBelowNet(control: AbstractControl): ValidationErrors | null {
  const gross: unknown = control.value;
  const net: unknown = control.parent?.get('netAmount')?.value;
  return typeof gross === 'number' && typeof net === 'number' && gross < net
    ? { grossBelowNet: true }
    : null;
}

@Component({
  selector: 'app-incomes',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    TooltipModule,
    EmptyStateComponent,
    ErrorStateComponent,
    FieldErrorComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  host: {
    '(document:keydown)': 'onShortcut($event)',
  },
  template: `
    <app-page-header
      eyebrow="Mzda"
      heading="Výplaty"
      description="Čistá mzda je to, čo prišlo na účet. Keď doplníš hrubú, uvidíš, koľko odišlo na odvodoch a dani."
    >
      @if (incomes().length) {
        <p-button
          label="Pridať výplatu"
          icon="pi pi-plus"
          pTooltip="Nová výplata (N)"
          tooltipPosition="bottom"
          (onClick)="openCreate()"
        />
      }
    </app-page-header>

    @if (list.error() && !incomes().length) {
      <app-error-state
        heading="Výplaty sa nepodarilo načítať"
        [error]="list.error()"
        (retry)="list.reload()"
      />
    } @else if (list.isLoading() && !incomes().length) {
      <div class="et-panel"><app-list-skeleton [rows]="4" /></div>
    } @else if (!incomes().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-briefcase"
          heading="Zatiaľ tu nie je žiadna výplata"
          message="Pridaj ju ručne. Čistú sumu nájdeš aj v importovaných transakciách, hrubú a zamestnávateľa dopíšeš sem."
        >
          <p-button label="Pridať výplatu" icon="pi pi-plus" (onClick)="openCreate()" />
          <a
            pButton
            routerLink="/transactions"
            [queryParams]="{ type: 'INCOME' }"
            severity="secondary"
            [outlined]="true"
            >Pozrieť príjmy</a
          >
        </app-empty-state>
      </div>
    } @else {
      <section class="stats et-panel" aria-label="Súhrn výplat">
        <div>
          <p class="et-eyebrow">Čistého spolu</p>
          <p class="et-num figure et-in">{{ totalNet() | currency: 'EUR' }}</p>
        </div>
        <div>
          <p class="et-eyebrow">Hrubého spolu</p>
          <p class="et-num figure">
            {{ totalGross() ? (totalGross() | currency: 'EUR') : '—' }}
          </p>
        </div>
        <div>
          <p class="et-eyebrow">Priemerná čistá</p>
          <p class="et-num figure">{{ averageNet() | currency: 'EUR' }}</p>
        </div>
        <div>
          <p class="et-eyebrow">Odvody a daň</p>
          @if (deductions() !== null) {
            <p class="et-num figure et-out">{{ deductions() | currency: 'EUR' }}</p>
          } @else {
            <p class="et-num figure et-faint" title="Doplň hrubú mzdu">—</p>
          }
        </div>
      </section>

      <div class="et-panel table-panel">
        <p-table [value]="incomes()" dataKey="id" size="small" class="et-stack-table">
          <ng-template #header>
            <tr>
              <th scope="col">Dátum</th>
              <th scope="col">Zamestnávateľ</th>
              <th scope="col" class="et-right col-gross">Hrubá</th>
              <th scope="col" class="et-right">Čistá</th>
              <th scope="col" class="et-right col-diff">Odvody</th>
              <th scope="col" class="col-note">Poznámka</th>
              <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr>
              <td class="c-date et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
              <td class="c-employer">{{ row.employer || '—' }}</td>
              <td class="et-right et-num col-gross">
                {{ row.grossAmount != null ? (row.grossAmount | currency: 'EUR') : '—' }}
              </td>
              <td class="c-net et-right et-num et-in">{{ row.netAmount | currency: 'EUR' }}</td>
              <td class="et-right et-num col-diff" [class.et-out]="row.grossAmount != null">
                {{
                  row.grossAmount != null
                    ? (row.grossAmount - row.netAmount | currency: 'EUR')
                    : '—'
                }}
              </td>
              <td class="col-note et-muted">{{ row.note || '' }}</td>
              <td class="c-actions et-actions">
                <p-button
                  icon="pi pi-pencil"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Upraviť výplatu"
                  (onClick)="openEdit(row)"
                />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Zmazať výplatu"
                  (onClick)="confirmDelete(row)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <p-dialog
      [header]="editing() ? 'Upraviť výplatu' : 'Nová výplata'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(30rem, calc(100vw - 1.5rem))' }"
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field-row">
          <div class="et-field">
            <label for="income-net">Čistá mzda</label>
            <p-inputnumber
              inputId="income-net"
              formControlName="netAmount"
              mode="currency"
              currency="EUR"
              locale="sk-SK"
              [min]="0"
              [fluid]="true"
            />
            <app-field-error [control]="form.controls.netAmount" />
          </div>

          <div class="et-field">
            <label for="income-gross">Hrubá mzda <span class="optional">(nepovinné)</span></label>
            <p-inputnumber
              inputId="income-gross"
              formControlName="grossAmount"
              mode="currency"
              currency="EUR"
              locale="sk-SK"
              [min]="0"
              [fluid]="true"
            />
            @if (form.controls.grossAmount.hasError('grossBelowNet')) {
              <small class="error" role="alert">Hrubá mzda nemôže byť nižšia ako čistá.</small>
            }
          </div>
        </div>

        <div class="et-field">
          <label for="income-date">Dátum výplaty</label>
          <p-datepicker
            inputId="income-date"
            formControlName="date"
            dateFormat="dd.mm.yy"
            [showIcon]="true"
            [showButtonBar]="true"
            appendTo="body"
            [fluid]="true"
          />
          <app-field-error [control]="form.controls.date" />
        </div>

        <div class="et-field">
          <label for="income-employer"
            >Zamestnávateľ <span class="optional">(nepovinné)</span></label
          >
          <input pInputText id="income-employer" formControlName="employer" maxlength="200" />
        </div>

        <div class="et-field">
          <label for="income-note">Poznámka <span class="optional">(nepovinné)</span></label>
          <input
            pInputText
            id="income-note"
            formControlName="note"
            maxlength="500"
            placeholder="napr. vrátane 13. platu"
          />
        </div>

        <div class="et-form-actions">
          <p-button
            label="Zrušiť"
            severity="secondary"
            [text]="true"
            (onClick)="dialogVisible.set(false)"
          />
          <p-button
            type="submit"
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať výplatu'"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(10rem, 100%), 1fr));
      gap: 1.25rem;
      margin-bottom: var(--et-s4);
    }

    .stats p {
      margin: 0;
    }

    .figure {
      margin-top: 0.375rem !important;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .table-panel {
      padding: var(--et-s2) var(--et-s3);
    }

    .c-net {
      font-weight: 500;
    }

    .col-note {
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.875rem;
    }

    .error {
      font-size: 0.75rem;
      color: var(--et-out);
    }

    @media (max-width: 1100px) {
      .col-note {
        display: none !important;
      }
    }

    @media (max-width: 720px) {
      .table-panel {
        padding: 0 var(--et-s2);
      }

      .col-gross,
      .col-diff {
        display: none !important;
      }

      tr {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'employer net'
          'date actions';
      }

      .c-employer {
        grid-area: employer;
        font-weight: 500;
      }

      .c-net {
        grid-area: net;
      }

      .c-date {
        grid-area: date;
        font-size: 0.8125rem;
        color: var(--et-faint);
      }

      .c-actions {
        grid-area: actions;
        margin-right: -0.5rem;
      }
    }
  `,
})
export class IncomesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly feedback = inject(FeedbackService);

  protected readonly incomes = this.incomeService.incomes;
  protected readonly list = rxResource({ stream: () => this.incomeService.load() });

  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Income | null>(null);

  protected readonly totalNet = computed(() =>
    this.incomes().reduce((sum, income) => sum + income.netAmount, 0),
  );

  protected readonly totalGross = computed(() =>
    this.incomes().reduce((sum, income) => sum + (income.grossAmount ?? 0), 0),
  );

  protected readonly averageNet = computed(() => {
    const all = this.incomes();
    return all.length ? this.totalNet() / all.length : 0;
  });

  /** Only meaningful once at least one gross amount has been filled in. */
  protected readonly deductions = computed(() => {
    let total: number | null = null;
    for (const income of this.incomes()) {
      if (income.grossAmount != null) {
        total = (total ?? 0) + income.grossAmount - income.netAmount;
      }
    }
    return total;
  });

  protected readonly form = this.fb.group({
    netAmount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    grossAmount: this.fb.control<number | null>(null, grossNotBelowNet),
    date: this.fb.control<Date | null>(new Date(), Validators.required),
    employer: this.fb.nonNullable.control(''),
    note: this.fb.nonNullable.control(''),
  });

  constructor() {
    // The gross check depends on net, so re-run it whenever net changes.
    this.form.controls.netAmount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.grossAmount.updateValueAndValidity({ emitEvent: false }));
  }

  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'n' && !shouldIgnoreShortcut(event)) {
      event.preventDefault();
      this.openCreate();
    }
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      netAmount: null,
      grossAmount: null,
      date: new Date(),
      employer: this.incomes()[0]?.employer ?? '',
      note: '',
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: Income): void {
    this.editing.set(row);
    this.form.reset({
      netAmount: row.netAmount,
      grossAmount: row.grossAmount,
      date: parseIsoDate(row.date),
      employer: row.employer ?? '',
      note: row.note ?? '',
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.netAmount === null || value.date === null) {
      return;
    }

    this.saving.set(true);

    const current = this.editing();
    const payload: IncomePayload = {
      date: toIsoDate(value.date),
      netAmount: value.netAmount,
      grossAmount: value.grossAmount,
      employer: value.employer.trim() || null,
      note: value.note.trim() || null,
      transactionId: current?.transactionId ?? null,
    };

    const request = current
      ? this.incomeService.update(current.id, payload)
      : this.incomeService.create(payload);

    request.subscribe({
      next: () => {
        this.feedback.success(current ? 'Výplata upravená' : 'Výplata pridaná');
        this.saving.set(false);
        this.dialogVisible.set(false);
      },
      error: (err: unknown) => {
        this.feedback.error('Výplatu sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(row: Income): void {
    const amount = row.netAmount.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
    const date = parseIsoDate(row.date)?.toLocaleDateString('sk-SK') ?? row.date;
    this.feedback.confirmDestructive({
      header: 'Zmazať výplatu?',
      message: `Výplata z ${date} (${amount}) sa natrvalo odstráni.`,
      accept: () =>
        this.incomeService.remove(row.id).subscribe({
          next: () => this.feedback.success('Výplata zmazaná'),
          error: (err: unknown) => this.feedback.error('Výplatu sa nepodarilo zmazať', err),
        }),
    });
  }
}
