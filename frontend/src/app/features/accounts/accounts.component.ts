import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AccountService } from '../../core/api/account.service';
import { Account } from '../../core/models';

@Component({
  selector: 'app-accounts',
  providers: [ConfirmationService],
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />

    <header class="page-head">
      <div>
        <p class="et-eyebrow">Nastavenia</p>
        <h1>Účty</h1>
      </div>
      <p-button label="Pridať" icon="pi pi-plus" (onClick)="openCreate()" />
    </header>

    <p-table [value]="accounts()" styleClass="p-datatable-sm">
      <ng-template #header>
        <tr>
          <th>Názov</th>
          <th>Mena</th>
          <th class="actions-col"></th>
        </tr>
      </ng-template>

      <ng-template #body let-row>
        <tr>
          <td>{{ row.name }}</td>
          <td>{{ row.currency }}</td>
          <td class="actions-col">
            <p-button icon="pi pi-pencil" severity="secondary" [text]="true" (onClick)="openEdit(row)" />
            <p-button icon="pi pi-trash" severity="danger" [text]="true" (onClick)="confirmDelete(row)" />
          </td>
        </tr>
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td colspan="3" class="empty">Zatiaľ nemáš žiadne účty. Pridaj si prvý.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="editing() ? 'Upraviť účet' : 'Nový účet'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '26rem' }"
    >
      <form [formGroup]="form" class="dialog-form">
        <div class="field">
          <label for="name">Názov</label>
          <input pInputText id="name" formControlName="name" placeholder="George bežný účet" />
        </div>

        <div class="field">
          <label for="currency">Mena</label>
          <p-select
            inputId="currency"
            formControlName="currency"
            [options]="currencies"
            placeholder="Vyber menu"
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

    .actions-col {
      width: 6rem;
      text-align: right;
      white-space: nowrap;
    }

    .empty {
      text-align: center;
      padding: 1.5rem 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class AccountsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly accounts = this.accountService.accounts;
  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Account | null>(null);

  protected readonly currencies = ['EUR', 'CZK', 'USD', 'GBP'];

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    currency: ['EUR', Validators.required],
  });

  constructor() {
    this.accountService.load().subscribe();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', currency: 'EUR' });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: Account): void {
    this.editing.set(row);
    this.form.reset({ name: row.name, currency: row.currency });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);

    const payload = this.form.getRawValue();
    const current = this.editing();
    const request = current
      ? this.accountService.update(current.id, payload)
      : this.accountService.create(payload);

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

  protected confirmDelete(row: Account): void {
    this.confirmation.confirm({
      header: 'Zmazať účet',
      message: `Naozaj chceš zmazať účet "${row.name}"?`,
      acceptLabel: 'Zmazať',
      rejectLabel: 'Zrušiť',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.accountService.remove(row.id).subscribe({
          next: () => this.messages.add({ severity: 'success', summary: 'Zmazané' }),
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: 'Nedá sa zmazať',
              detail: err.error?.detail ?? 'Účet má transakcie.',
            }),
        }),
    });
  }
}
