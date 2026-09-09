import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { AccountService } from '../../core/api/account.service';
import { ImportService } from '../../core/api/import.service';
import { ImportBatch, ImportPreview } from '../../core/models';
import { chartPalette } from '../../theme';

@Component({
  selector: 'app-import',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    FileUploadModule,
    MessageModule,
    SelectModule,
    TableModule,
    TagModule,
  ],
  template: `
    <header class="page-head">
      <p class="et-eyebrow">Výpis z banky</p>
      <h1>Import z CSV</h1>
    </header>

    <p-message severity="info" styleClass="mb-3">
      Nahraj CSV export z George. Pred uložením uvidíš, čo sa načítalo.
    </p-message>

    <p-card header="1. Nahraj súbor">
      <div class="upload-row">
        <p-select
          [(ngModel)]="selectedAccountId"
          [options]="accounts()"
          optionLabel="name"
          optionValue="id"
          placeholder="Cieľový účet"
        />

        <p-fileupload
          mode="basic"
          accept=".csv,text/csv"
          chooseLabel="Vybrať CSV"
          [auto]="true"
          [customUpload]="true"
          (uploadHandler)="onSelect($event)"
        />
      </div>

      @if (!accounts().length) {
        <p-message severity="warn" styleClass="mt-3">
          Najprv si vytvor aspoň jeden účet v sekcii Účty.
        </p-message>
      }
    </p-card>

    @if (preview(); as data) {
      <p-card header="2. Skontroluj dáta" styleClass="mt-3">
        <div class="summary">
          <p-tag [value]="data.totalRows + ' riadkov'" severity="secondary" />
          <p-tag [value]="data.validRows + ' platných'" severity="success" />
          @if (data.invalidRows) {
            <p-tag [value]="data.invalidRows + ' chybných'" severity="danger" />
          }
          <p-tag [value]="data.categorisedRows + ' zaradených'" severity="warn" />
        </div>

        <p-table [value]="data.rows" [scrollable]="true" scrollHeight="24rem" styleClass="p-datatable-sm">
          <ng-template #header>
            <tr>
              <th class="line-col">#</th>
              <th>Dátum</th>
              <th>Popis</th>
              <th>Kategória</th>
              <th>Typ</th>
              <th class="right">Suma</th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr [class.invalid-row]="row.error">
              <td class="line-col">{{ row.lineNumber }}</td>
              @if (row.error) {
                <td colspan="5" class="error-cell">{{ row.error }}</td>
              } @else {
                <td class="et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
                <td>{{ row.description }}</td>
                <td>
                  @if (row.categoryName) {
                    <span class="dot" [style.background]="row.categoryColor ?? uncategorised"></span>
                    {{ row.categoryName }}
                  } @else {
                    <span class="unmatched">Nezaradené</span>
                  }
                </td>
                <td>
                  <p-tag
                    [value]="row.type === 'EXPENSE' ? 'Výdavok' : 'Príjem'"
                    [severity]="row.type === 'EXPENSE' ? 'danger' : 'success'"
                  />
                </td>
                <td class="right et-num">{{ row.amount | currency: 'EUR' }}</td>
              }
            </tr>
          </ng-template>
        </p-table>

        <div class="confirm-row">
          <p-button label="Zrušiť" severity="secondary" [text]="true" (onClick)="reset()" />
          <p-button
            [label]="'Importovať ' + data.validRows + ' transakcií'"
            icon="pi pi-check"
            [loading]="importing()"
            [disabled]="!selectedAccountId || !data.validRows"
            (onClick)="confirm()"
          />
        </div>
      </p-card>
    }

    <p-card header="História importov" styleClass="mt-3">
      <p-table [value]="batches()" styleClass="p-datatable-sm">
        <ng-template #header>
          <tr>
            <th>Súbor</th>
            <th>Kedy</th>
            <th class="right">Riadkov</th>
            <th>Stav</th>
          </tr>
        </ng-template>

        <ng-template #body let-row>
          <tr>
            <td>{{ row.filename }}</td>
            <td>{{ row.importedAt | date: 'dd.MM.yyyy HH:mm' }}</td>
            <td class="right et-num">{{ row.rowCount }}</td>
            <td>
              <p-tag
                [value]="row.status"
                [severity]="row.status === 'COMPLETED' ? 'success' : 'danger'"
              />
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="4" class="empty">Zatiaľ žiadne importy.</td>
          </tr>
        </ng-template>
      </p-table>
    </p-card>
  `,
  styles: `
    .page-head {
      margin-bottom: 1.5rem;
    }

    h1 {
      margin: 0.25rem 0 0;
      font-size: 1.75rem;
    }

    .upload-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .summary {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .confirm-row {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .invalid-row {
      background: rgba(224, 128, 92, 0.08);
    }

    .error-cell {
      color: var(--et-out);
      font-size: 0.875rem;
    }

    .line-col {
      width: 3.5rem;
      color: var(--et-faint);
    }

    .dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      margin-right: 0.5rem;
      vertical-align: middle;
    }

    .unmatched {
      color: var(--et-faint);
    }

    .right {
      text-align: right;
    }

    .empty {
      text-align: center;
      padding: 1.5rem 0;
      color: var(--et-faint);
    }

    :host ::ng-deep .mt-3 {
      margin-top: 1rem;
    }

    :host ::ng-deep .mb-3 {
      margin-bottom: 1rem;
    }

    :host ::ng-deep .w-full {
      width: 100%;
    }
  `,
})
export class ImportComponent {
  private readonly importService = inject(ImportService);
  private readonly accountService = inject(AccountService);
  private readonly messages = inject(MessageService);

  protected readonly uncategorised = chartPalette.faint;
  protected readonly accounts = this.accountService.accounts;
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly batches = signal<ImportBatch[]>([]);
  protected readonly importing = signal(false);

  protected selectedAccountId: string | null = null;
  private selectedFile: File | null = null;

  constructor() {
    this.accountService.load().subscribe();
    this.loadBatches();
  }

  protected onSelect(event: { files: File[] }): void {
    const file = event.files[0];
    if (!file) {
      return;
    }

    this.selectedFile = file;

    this.importService.preview(file).subscribe({
      next: (preview) => this.preview.set(preview),
      error: () => this.messages.add({ severity: 'error', summary: 'Súbor sa nepodarilo načítať' }),
    });
  }

  protected confirm(): void {
    if (!this.selectedFile || !this.selectedAccountId) {
      return;
    }

    this.importing.set(true);

    this.importService.confirm(this.selectedFile, this.selectedAccountId).subscribe({
      next: (batch) => {
        this.messages.add({
          severity: 'success',
          summary: 'Import dokončený',
          detail: `${batch.rowCount} transakcií`,
        });
        this.importing.set(false);
        this.reset();
        this.loadBatches();
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Import zlyhal' });
        this.importing.set(false);
      },
    });
  }

  protected reset(): void {
    this.preview.set(null);
    this.selectedFile = null;
  }

  private loadBatches(): void {
    this.importService.batches().subscribe((batches) => this.batches.set(batches));
  }
}
