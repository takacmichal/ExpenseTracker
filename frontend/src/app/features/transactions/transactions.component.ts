import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AccountService } from '../../core/api/account.service';
import { CategoryService } from '../../core/api/category.service';
import { TransactionService } from '../../core/api/transaction.service';
import { Transaction, TransactionType } from '../../core/models';
import { toIsoDate } from '../../core/date-utils';

@Component({
  selector: 'app-transactions',
  providers: [ConfirmationService],
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />

    <header class="page-head">
      <div>
        <p class="et-eyebrow">Pohyby</p>
        <h1>Transakcie</h1>
      </div>
      <div class="head-actions">
        <p-button
          label="Prekategorizovať"
          icon="pi pi-sparkles"
          severity="secondary"
          [text]="true"
          [loading]="categorising()"
          (onClick)="categorise()"
        />
        <p-button label="Pridať" icon="pi pi-plus" (onClick)="openCreate()" />
      </div>
    </header>

    <p-card styleClass="filters-card">
      <div class="filters">
        <p-datepicker
          [(ngModel)]="filterRange"
          selectionMode="range"
          dateFormat="dd.mm.yy"
          placeholder="Obdobie"
          [showIcon]="true"
          [showButtonBar]="true"
          (onSelect)="reload()"
          (onClear)="reload()"
        />

        <p-select
          [(ngModel)]="filterCategoryId"
          [options]="categoryOptions()"
          optionLabel="name"
          optionValue="id"
          placeholder="Kategória"
          [showClear]="true"
          (onChange)="reload()"
        />

        <p-select
          [(ngModel)]="filterAccountId"
          [options]="accounts()"
          optionLabel="name"
          optionValue="id"
          placeholder="Účet"
          [showClear]="true"
          (onChange)="reload()"
        />

        <p-select
          [(ngModel)]="filterType"
          [options]="typeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Typ"
          [showClear]="true"
          (onChange)="reload()"
        />
      </div>
    </p-card>

    <p-table
      [value]="rows()"
      [lazy]="true"
      [paginator]="true"
      [rows]="pageSize"
      [totalRecords]="totalRecords()"
      [loading]="loading()"
      (onPage)="onPage($event)"
      styleClass="p-datatable-sm"
    >
      <ng-template #header>
        <tr>
          <th>Dátum</th>
          <th>Popis</th>
          <th>Kategória</th>
          <th>Účet</th>
          <th>Zdroj</th>
          <th class="right">Suma</th>
          <th class="actions-col"></th>
        </tr>
      </ng-template>

      <ng-template #body let-row>
        <tr>
          <td class="et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
          <td>{{ row.description || '—' }}</td>
          <td>
            @if (row.categoryName) {
              <span class="swatch" [style.background]="row.categoryColor ?? '#94a3b8'"></span>
              {{ row.categoryName }}
            } @else {
              <span class="muted">Nezaradené</span>
            }
          </td>
          <td>{{ row.accountName }}</td>
          <td>
            <p-tag
              [value]="row.source === 'IMPORT' ? 'Import' : 'Ručne'"
              [severity]="row.source === 'IMPORT' ? 'info' : 'secondary'"
            />
          </td>
          <td
            class="right et-num"
            [class.et-in]="row.type === 'INCOME'"
            [class.et-out]="row.type === 'EXPENSE'"
          >
            {{ row.type === 'EXPENSE' ? '−' : '+' }}{{ row.amount | currency: 'EUR' }}
          </td>
          <td class="actions-col">
            <p-button icon="pi pi-pencil" severity="secondary" [text]="true" (onClick)="openEdit(row)" />
            <p-button icon="pi pi-trash" severity="danger" [text]="true" (onClick)="confirmDelete(row)" />
          </td>
        </tr>
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td colspan="7" class="empty">Žiadne transakcie.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="editing() ? 'Upraviť transakciu' : 'Nová transakcia'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '30rem' }"
    >
      <form [formGroup]="form" (ngSubmit)="save()" class="dialog-form">
        <div class="field">
          <label for="type">Typ</label>
          <p-select
            inputId="type"
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <div class="field">
          <label for="amount">Suma</label>
          <p-inputnumber
            inputId="amount"
            formControlName="amount"
            mode="currency"
            currency="EUR"
            locale="sk-SK"
          />
        </div>

        <div class="field">
          <label for="date">Dátum</label>
          <p-datepicker inputId="date" formControlName="date" dateFormat="dd.mm.yy" [showIcon]="true" />
        </div>

        <div class="field">
          <label for="description">Popis</label>
          <input pInputText id="description" formControlName="description" />
        </div>

        <div class="field">
          <label for="accountId">Účet</label>
          <p-select
            inputId="accountId"
            formControlName="accountId"
            [options]="accounts()"
            optionLabel="name"
            optionValue="id"
            placeholder="Vyber účet"
          />
        </div>

        <div class="field">
          <label for="categoryId">Kategória</label>
          <p-select
            inputId="categoryId"
            formControlName="categoryId"
            [options]="categoryOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Bez kategórie"
            [showClear]="true"
          />
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

    .head-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    :host ::ng-deep .filters-card {
      margin-bottom: 1rem;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
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

    .swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      margin-right: 0.5rem;
      vertical-align: middle;
    }

    .right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .income {
      color: var(--p-green-500);
    }

    .expense {
      color: var(--p-red-500);
    }

    .muted,
    .empty {
      color: var(--p-text-muted-color);
    }

    .empty {
      text-align: center;
      padding: 1.5rem 0;
    }

    .actions-col {
      width: 6rem;
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class TransactionsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly transactions = inject(TransactionService);
  private readonly accountService = inject(AccountService);
  private readonly categoryService = inject(CategoryService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly pageSize = 25;

  protected readonly rows = signal<Transaction[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Transaction | null>(null);
  protected readonly categorising = signal(false);

  protected readonly accounts = this.accountService.accounts;
  protected readonly categories = this.categoryService.categories;

  protected filterRange: Date[] | null = null;
  protected filterCategoryId: string | null = null;
  protected filterAccountId: string | null = null;
  protected filterType: TransactionType | null = null;
  private page = 0;

  protected readonly typeOptions = [
    { label: 'Výdavok', value: 'EXPENSE' as TransactionType },
    { label: 'Príjem', value: 'INCOME' as TransactionType },
  ];

  protected readonly categoryOptions = this.categories;

  protected readonly form = this.fb.nonNullable.group({
    type: ['EXPENSE' as TransactionType, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [new Date(), Validators.required],
    description: [''],
    accountId: ['', Validators.required],
    categoryId: [null as string | null],
  });

  constructor() {
    this.accountService.load().subscribe();
    this.categoryService.load().subscribe();
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);

    const [from, to] = this.filterRange ?? [];

    this.transactions
      .search({
        from: from ? toIsoDate(from) : null,
        to: to ? toIsoDate(to) : null,
        categoryId: this.filterCategoryId,
        accountId: this.filterAccountId,
        type: this.filterType,
        page: this.page,
        size: this.pageSize,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.totalRecords.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onPage(event: TablePageEvent): void {
    this.page = Math.floor(event.first / event.rows);
    this.reload();
  }

  protected categorise(): void {
    this.categorising.set(true);

    this.transactions.categorise().subscribe({
      next: (result) => {
        this.categorising.set(false);
        this.messages.add({
          severity: result.updated ? 'success' : 'info',
          summary: result.updated
            ? `Zaradených ${result.updated} transakcií`
            : 'Podľa pravidiel sa nedalo zaradiť nič ďalšie',
        });
        this.reload();
      },
      error: () => {
        this.categorising.set(false);
        this.messages.add({ severity: 'error', summary: 'Prekategorizovanie zlyhalo' });
      },
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      type: 'EXPENSE',
      amount: 0,
      date: new Date(),
      description: '',
      accountId: this.accounts()[0]?.id ?? '',
      categoryId: null,
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: Transaction): void {
    this.editing.set(row);
    this.form.reset({
      type: row.type,
      amount: row.amount,
      date: new Date(row.date),
      description: row.description ?? '',
      accountId: row.accountId,
      categoryId: row.categoryId,
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
      type: value.type,
      amount: value.amount,
      date: toIsoDate(value.date),
      description: value.description || null,
      accountId: value.accountId,
      categoryId: value.categoryId,
    };

    const current = this.editing();
    const request = current
      ? this.transactions.update(current.id, payload)
      : this.transactions.create(payload);

    request.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Uložené' });
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.reload();
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Uloženie zlyhalo' });
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(row: Transaction): void {
    this.confirmation.confirm({
      header: 'Zmazať transakciu',
      message: 'Naozaj chceš zmazať túto transakciu?',
      acceptLabel: 'Zmazať',
      rejectLabel: 'Zrušiť',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.transactions.remove(row.id).subscribe(() => {
          this.messages.add({ severity: 'success', summary: 'Zmazané' });
          this.reload();
        }),
    });
  }
}
