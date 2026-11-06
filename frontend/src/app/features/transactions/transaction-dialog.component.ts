import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';

import { TransactionService } from '../../core/api/transaction.service';
import { Account, Category, Transaction, TransactionType } from '../../core/models';
import { TRANSACTION_TYPE_OPTIONS } from '../../core/labels';
import { parseIsoDate, toIsoDate } from '../../core/date-utils';
import { FeedbackService } from '../../core/ui/feedback.service';
import { FieldErrorComponent } from '../../shared/field-error.component';

/** Create/edit dialog for one transaction. The parent opens it with `open()`. */
@Component({
  selector: 'app-transaction-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    FieldErrorComponent,
  ],
  template: `
    <p-dialog
      [header]="editing() ? 'Upraviť transakciu' : 'Nová transakcia'"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(32rem, calc(100vw - 1.5rem))' }"
    >
      @if (!accounts().length) {
        <p class="no-account">
          Transakcia patrí vždy k nejakému účtu. Najprv si
          <a routerLink="/accounts" (click)="visible.set(false)">vytvor účet</a>.
        </p>
      }

      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field-row">
          <div class="et-field">
            <label for="tx-amount">Suma</label>
            <p-inputnumber
              inputId="tx-amount"
              formControlName="amount"
              mode="currency"
              currency="EUR"
              locale="sk-SK"
              [min]="0"
              [fluid]="true"
            />
            <app-field-error [control]="form.controls.amount" />
          </div>

          <div class="et-field">
            <span class="label" id="tx-type-label">Typ</span>
            <p-selectbutton
              formControlName="type"
              [options]="typeOptions"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              [fluid]="true"
              ariaLabelledBy="tx-type-label"
            />
          </div>
        </div>

        <div class="et-field">
          <label for="tx-date">Dátum</label>
          <p-datepicker
            inputId="tx-date"
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
          <label for="tx-description">Popis <span class="optional">(nepovinné)</span></label>
          <input
            pInputText
            id="tx-description"
            formControlName="description"
            maxlength="500"
            placeholder="napr. Nákup v Bille"
          />
        </div>

        <div class="et-field-row">
          <div class="et-field">
            <label for="tx-account">Účet</label>
            <p-select
              inputId="tx-account"
              formControlName="accountId"
              [options]="accounts()"
              optionLabel="name"
              optionValue="id"
              placeholder="Vyber účet"
              appendTo="body"
              [fluid]="true"
            />
            <app-field-error [control]="form.controls.accountId" />
          </div>

          <div class="et-field">
            <label for="tx-category">Kategória</label>
            <p-select
              inputId="tx-category"
              formControlName="categoryId"
              [options]="categoryOptions()"
              optionLabel="name"
              optionValue="id"
              placeholder="Bez kategórie"
              [showClear]="true"
              [filter]="categoryOptions().length > 8"
              filterBy="name"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        </div>

        <div class="et-form-actions">
          <p-button
            label="Zrušiť"
            severity="secondary"
            [text]="true"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať transakciu'"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--et-muted);
    }

    .no-account {
      margin: 0 0 var(--et-s4);
      padding: var(--et-s3);
      border-radius: var(--et-radius-sm);
      background: var(--et-surface-2);
      font-size: 0.875rem;
      color: var(--et-muted);
    }
  `,
})
export class TransactionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly transactions = inject(TransactionService);
  private readonly feedback = inject(FeedbackService);

  readonly accounts = input.required<Account[]>();
  readonly categories = input.required<Category[]>();
  readonly saved = output<void>();

  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Transaction | null>(null);

  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;

  protected readonly form = this.fb.group({
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    type: this.fb.nonNullable.control<TransactionType>('EXPENSE'),
    date: this.fb.control<Date | null>(new Date(), Validators.required),
    description: this.fb.nonNullable.control(''),
    accountId: this.fb.control<string | null>(null, Validators.required),
    categoryId: this.fb.control<string | null>(null),
  });

  private readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  /** Only categories that face the same way as the transaction make sense for it. */
  protected readonly categoryOptions = computed(() =>
    this.categories().filter((category) => category.type === this.selectedType()),
  );

  constructor() {
    // Switching type drops a category that now points the wrong way.
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const categoryId = this.form.controls.categoryId.value;
      const category = this.categories().find((c) => c.id === categoryId);
      if (category && category.type !== type) {
        this.form.controls.categoryId.setValue(null);
      }
    });

    // Accounts may arrive after the dialog was opened from a deep link.
    effect(() => {
      const first = this.accounts()[0];
      if (this.visible() && first && !this.form.controls.accountId.value) {
        this.form.controls.accountId.setValue(first.id);
      }
    });
  }

  open(transaction: Transaction | null = null): void {
    this.editing.set(transaction);
    this.form.reset(
      transaction
        ? {
            amount: transaction.amount,
            type: transaction.type,
            date: parseIsoDate(transaction.date),
            description: transaction.description ?? '',
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
          }
        : {
            amount: null,
            type: 'EXPENSE',
            date: new Date(),
            description: '',
            accountId: this.accounts()[0]?.id ?? null,
            categoryId: null,
          },
    );
    this.visible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.amount === null || value.date === null || value.accountId === null) {
      return;
    }

    this.saving.set(true);

    const payload = {
      type: value.type,
      amount: value.amount,
      date: toIsoDate(value.date),
      description: value.description.trim() || null,
      accountId: value.accountId,
      categoryId: value.categoryId,
    };

    const current = this.editing();
    const request = current
      ? this.transactions.update(current.id, payload)
      : this.transactions.create(payload);

    request.subscribe({
      next: () => {
        this.feedback.success(current ? 'Transakcia upravená' : 'Transakcia pridaná');
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.feedback.error('Transakciu sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }
}
