import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { IncomeService } from '../../core/api/income.service';
import { Income } from '../../core/models';
import { toIsoDate } from '../../core/date-utils';

@Component({
  selector: 'app-incomes',
  providers: [ConfirmationService],
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />

    <header class="page-head">
      <div>
        <p class="et-eyebrow">Mzda</p>
        <h1>Výplaty</h1>
      </div>
      <p-button label="Pridať" icon="pi pi-plus" (onClick)="openCreate()" />
    </header>

    @if (incomes().length) {
      <section class="stats">
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
          <p class="et-num figure et-out">
            {{ deductions() !== null ? (deductions()! | currency: 'EUR') : '—' }}
          </p>
        </div>
      </section>
    }

    <p-table [value]="incomes()" styleClass="p-datatable-sm">
      <ng-template #header>
        <tr>
          <th>Dátum</th>
          <th>Zamestnávateľ</th>
          <th class="right">Hrubá</th>
          <th class="right">Čistá</th>
          <th class="right">Rozdiel</th>
          <th>Poznámka</th>
          <th class="actions-col"></th>
        </tr>
      </ng-template>

      <ng-template #body let-row>
        <tr>
          <td class="et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
          <td>{{ row.employer || '—' }}</td>
          <td class="right et-num">{{ row.grossAmount ? (row.grossAmount | currency: 'EUR') : '—' }}</td>
          <td class="right et-num et-in">{{ row.netAmount | currency: 'EUR' }}</td>
          <td class="right et-num et-out">
            {{ row.grossAmount ? (row.grossAmount - row.netAmount | currency: 'EUR') : '—' }}
          </td>
          <td class="note">{{ row.note || '' }}</td>
          <td class="actions-col">
            <p-button icon="pi pi-pencil" severity="secondary" [text]="true" ariaLabel="Upraviť" (onClick)="openEdit(row)" />
            <p-button icon="pi pi-trash" severity="danger" [text]="true" ariaLabel="Vymazať" (onClick)="confirmDelete(row)" />
          </td>
        </tr>
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td colspan="7" class="empty">
            <p>Zatiaľ tu nie je žiadna výplata.</p>
            <p class="hint">
              Čistú sumu ti doplní import z banky, hrubú a zamestnávateľa dopíš ručne.
            </p>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="editing() ? 'Upraviť výplatu' : 'Nová výplata'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '28rem' }"
    >
      <form [formGroup]="form" class="dialog-form">
        <div class="field">
          <label for="date">Dátum</label>
          <p-datepicker inputId="date" formControlName="date" dateFormat="dd.mm.yy" [showIcon]="true" />
        </div>

        <div class="field">
          <label for="netAmount">Čistá mzda</label>
          <p-inputnumber
            inputId="netAmount"
            formControlName="netAmount"
            mode="currency"
            currency="EUR"
            locale="sk-SK"
          />
        </div>

        <div class="field">
          <label for="grossAmount">Hrubá mzda</label>
          <p-inputnumber
            inputId="grossAmount"
            formControlName="grossAmount"
            mode="currency"
            currency="EUR"
            locale="sk-SK"
          />
          <small>Nepovinné — doplň, keď chceš vidieť odvody.</small>
        </div>

        <div class="field">
          <label for="employer">Zamestnávateľ</label>
          <input pInputText id="employer" formControlName="employer" />
        </div>

        <div class="field">
          <label for="note">Poznámka</label>
          <input pInputText id="note" formControlName="note" />
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Zrušiť" severity="secondary" [text]="true" (onClick)="dialogVisible.set(false)" />
        <p-button label="Uložiť" [disabled]="form.invalid" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
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

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 1.25rem;
      padding: 1.25rem 1.5rem;
      border: 1px solid var(--et-line);
      border-radius: 0.875rem;
      background: var(--et-surface);
      margin-bottom: 1rem;
    }

    .stats p {
      margin: 0;
    }

    .figure {
      margin-top: 0.375rem !important;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 0.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field label {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .field small {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .right {
      text-align: right;
    }

    .note {
      color: var(--et-muted);
      font-size: 0.875rem;
    }

    .actions-col {
      width: 6rem;
      text-align: right;
      white-space: nowrap;
    }

    .empty {
      text-align: center;
      padding: 2rem 0;
      color: var(--et-muted);
    }

    .empty p {
      margin: 0;
    }

    .hint {
      margin-top: 0.375rem !important;
      font-size: 0.875rem;
      color: var(--et-faint);
    }
  `,
})
export class IncomesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly incomes = this.incomeService.incomes;
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
    const withGross = this.incomes().filter((income) => income.grossAmount !== null);
    if (!withGross.length) {
      return null;
    }
    return withGross.reduce((sum, income) => sum + (income.grossAmount! - income.netAmount), 0);
  });

  protected readonly form = this.fb.nonNullable.group({
    date: [new Date(), Validators.required],
    netAmount: [0, [Validators.required, Validators.min(0.01)]],
    grossAmount: [null as number | null],
    employer: [''],
    note: [''],
  });

  constructor() {
    this.incomeService.load().subscribe();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ date: new Date(), netAmount: 0, grossAmount: null, employer: '', note: '' });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: Income): void {
    this.editing.set(row);
    this.form.reset({
      date: new Date(row.date),
      netAmount: row.netAmount,
      grossAmount: row.grossAmount,
      employer: row.employer ?? '',
      note: row.note ?? '',
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload = {
      date: toIsoDate(value.date),
      netAmount: value.netAmount,
      grossAmount: value.grossAmount,
      employer: value.employer || null,
      note: value.note || null,
      transactionId: this.editing()?.transactionId ?? null,
    };

    const current = this.editing();
    const request = current
      ? this.incomeService.update(current.id, payload)
      : this.incomeService.create(payload);

    request.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Uložené' });
        this.saving.set(false);
        this.dialogVisible.set(false);
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Uloženie zlyhalo' });
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(row: Income): void {
    this.confirmation.confirm({
      header: 'Zmazať výplatu',
      message: 'Naozaj chceš zmazať tento záznam?',
      acceptLabel: 'Zmazať',
      rejectLabel: 'Zrušiť',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.incomeService.remove(row.id).subscribe(() => {
          this.messages.add({ severity: 'success', summary: 'Zmazané' });
        }),
    });
  }
}
