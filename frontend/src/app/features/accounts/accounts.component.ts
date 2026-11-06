import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { AccountService } from '../../core/api/account.service';
import { Account } from '../../core/models';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-accounts',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
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
      eyebrow="Nastavenia"
      heading="Účty"
      description="Bankové účty, karty alebo hotovosť. Každá transakcia patrí k jednému z nich."
    >
      @if (accounts().length) {
        <p-button
          label="Pridať účet"
          icon="pi pi-plus"
          pTooltip="Nový účet (N)"
          tooltipPosition="bottom"
          (onClick)="openCreate()"
        />
      }
    </app-page-header>

    @if (list.error() && !accounts().length) {
      <app-error-state
        heading="Účty sa nepodarilo načítať"
        [error]="list.error()"
        (retry)="list.reload()"
      />
    } @else if (list.isLoading() && !accounts().length) {
      <div class="et-panel"><app-list-skeleton [rows]="3" /></div>
    } @else if (!accounts().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-credit-card"
          heading="Zatiaľ nemáš žiadny účet"
          message="Založ si aspoň jeden, napríklad bežný účet v banke. Potom môžeš pridávať transakcie a importovať výpisy."
        >
          <p-button label="Pridať prvý účet" icon="pi pi-plus" (onClick)="openCreate()" />
        </app-empty-state>
      </div>
    } @else {
      <div class="et-panel table-panel">
        <p-table [value]="accounts()" dataKey="id" size="small">
          <ng-template #header>
            <tr>
              <th scope="col">Názov</th>
              <th scope="col">Mena</th>
              <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr>
              <td class="name">{{ row.name }}</td>
              <td class="et-num et-muted">{{ row.currency }}</td>
              <td class="et-actions">
                <p-button
                  icon="pi pi-pencil"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="'Upraviť účet ' + row.name"
                  (onClick)="openEdit(row)"
                />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="'Zmazať účet ' + row.name"
                  (onClick)="confirmDelete(row)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>

      <p class="next et-faint">Výpis z banky nahráš v sekcii <a routerLink="/import">Import</a>.</p>
    }

    <p-dialog
      [header]="editing() ? 'Upraviť účet' : 'Nový účet'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(26rem, calc(100vw - 1.5rem))' }"
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field">
          <label for="account-name">Názov</label>
          <input
            pInputText
            id="account-name"
            formControlName="name"
            maxlength="100"
            placeholder="napr. George bežný účet"
          />
          <app-field-error [control]="form.controls.name" />
        </div>

        <div class="et-field">
          <label for="account-currency">Mena</label>
          <p-select
            inputId="account-currency"
            formControlName="currency"
            [options]="currencies"
            appendTo="body"
            [fluid]="true"
          />
          <app-field-error [control]="form.controls.currency" />
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
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať účet'"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .table-panel {
      padding: var(--et-s2) var(--et-s3);
    }

    .name {
      font-weight: 500;
    }

    .next {
      margin: var(--et-s3) 0 0;
      font-size: 0.875rem;
    }
  `,
})
export class AccountsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly feedback = inject(FeedbackService);

  protected readonly accounts = this.accountService.accounts;
  protected readonly list = rxResource({ stream: () => this.accountService.load() });

  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Account | null>(null);

  protected readonly currencies = ['EUR', 'CZK', 'USD', 'GBP'];

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    currency: ['EUR', Validators.required],
  });

  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'n' && !shouldIgnoreShortcut(event)) {
      event.preventDefault();
      this.openCreate();
    }
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
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload = { ...value, name: value.name.trim() };
    const current = this.editing();
    const request = current
      ? this.accountService.update(current.id, payload)
      : this.accountService.create(payload);

    request.subscribe({
      next: () => {
        this.feedback.success(current ? 'Účet upravený' : 'Účet pridaný', payload.name);
        this.saving.set(false);
        this.dialogVisible.set(false);
      },
      error: (err: unknown) => {
        this.feedback.error('Účet sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(row: Account): void {
    this.feedback.confirmDestructive({
      header: 'Zmazať účet?',
      message: `Účet „${row.name}“ sa natrvalo odstráni. Účet, ktorý má transakcie, zmazať nejde.`,
      accept: () =>
        this.accountService.remove(row.id).subscribe({
          next: () => this.feedback.success('Účet zmazaný', row.name),
          error: (err: unknown) =>
            this.feedback.error('Účet sa nedá zmazať', err, 'Pravdepodobne má transakcie.'),
        }),
    });
  }
}
