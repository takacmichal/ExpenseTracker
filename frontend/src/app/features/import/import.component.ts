import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { FileUpload, FileUploadHandlerEvent, FileUploadModule } from 'primeng/fileupload';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AccountService } from '../../core/api/account.service';
import { ImportService } from '../../core/api/import.service';
import { ImportBatch, ImportPreview } from '../../core/models';
import { IMPORT_STATUS_LABELS, plural } from '../../core/labels';
import { FeedbackService } from '../../core/ui/feedback.service';
import { UNCATEGORISED_COLOR } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { TypeBadgeComponent } from '../../shared/type-badge.component';

type TagSeverity = 'success' | 'danger' | 'warn';

const STATUS_SEVERITY: Record<ImportBatch['status'], TagSeverity> = {
  COMPLETED: 'success',
  FAILED: 'danger',
  PENDING: 'warn',
};

@Component({
  selector: 'app-import',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    FileUploadModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    EmptyStateComponent,
    ErrorStateComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    TypeBadgeComponent,
  ],
  template: `
    <app-page-header
      eyebrow="Výpis z banky"
      heading="Import z CSV"
      description="Nahraj CSV export z George (Slovenská sporiteľňa). Pred uložením uvidíš, čo sa načítalo a ako sa to zaradí."
    />

    @if (accountsLoad.error() && !accounts().length) {
      <app-error-state
        heading="Účty sa nepodarilo načítať"
        [error]="accountsLoad.error()"
        (retry)="accountsLoad.reload()"
      />
    } @else if (accountsLoad.isLoading() && !accounts().length) {
      <div class="et-panel"><app-list-skeleton [rows]="2" /></div>
    } @else if (!accounts().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-credit-card"
          heading="Najprv si vytvor účet"
          message="Importované transakcie sa uložia k jednému z tvojich účtov."
        >
          <a pButton routerLink="/accounts"
            ><i class="pi pi-plus" aria-hidden="true"></i>Vytvoriť účet</a
          >
        </app-empty-state>
      </div>
    } @else {
      <section class="et-panel step" aria-labelledby="step-upload">
        <h2 id="step-upload" class="step-head">
          <span class="step-no et-num" aria-hidden="true">1</span> Vyber účet a súbor
        </h2>

        <div class="upload-row">
          <div class="et-field account">
            <label for="import-account">Cieľový účet</label>
            <p-select
              inputId="import-account"
              [ngModel]="selectedAccountId()"
              (ngModelChange)="onAccountChange($event)"
              [options]="accounts()"
              optionLabel="name"
              optionValue="id"
              placeholder="Vyber účet"
              [fluid]="true"
            />
          </div>

          <p-fileupload
            mode="basic"
            accept=".csv,text/csv"
            [chooseLabel]="previewing() ? 'Načítavam…' : 'Vybrať CSV súbor'"
            chooseIcon="pi pi-file-import"
            [auto]="true"
            [customUpload]="true"
            [disabled]="previewing()"
            [maxFileSize]="10_000_000"
            (uploadHandler)="onSelect($event)"
          />
        </div>

        @if (fileName(); as name) {
          <p class="file et-faint"><i class="pi pi-file" aria-hidden="true"></i> {{ name }}</p>
        }
      </section>

      @if (preview(); as data) {
        <section class="et-panel step" aria-labelledby="step-review">
          <h2 id="step-review" class="step-head">
            <span class="step-no et-num" aria-hidden="true">2</span> Skontroluj a ulož
          </h2>

          <div class="summary">
            <p-tag [value]="rowsLabel(data.totalRows)" severity="secondary" />
            <p-tag [value]="importableRows(data) + ' na import'" severity="secondary" />
            <p-tag [value]="data.categorisedRows + ' zaradených'" severity="secondary" />
            @if (data.duplicateRows) {
              <p-tag [value]="duplicatesLabel(data.duplicateRows)" severity="warn" />
            }
            @if (data.invalidRows) {
              <p-tag [value]="data.invalidRows + ' chybných, preskočia sa'" severity="danger" />
            }
          </div>

          <p-table
            [value]="data.rows"
            [scrollable]="true"
            scrollHeight="26rem"
            size="small"
            class="et-stack-table"
          >
            <ng-template #header>
              <tr>
                <th scope="col" class="line-col">#</th>
                <th scope="col">Dátum</th>
                <th scope="col">Popis</th>
                <th scope="col">Kategória</th>
                <th scope="col">Typ</th>
                <th scope="col" class="et-right">Suma</th>
              </tr>
            </ng-template>

            <ng-template #body let-row>
              <tr [class.invalid-row]="row.error" [class.duplicate-row]="row.duplicate">
                <td class="line-col et-num">{{ row.lineNumber }}</td>
                @if (row.error) {
                  <td colspan="5" class="error-cell">
                    <i class="pi pi-exclamation-circle" aria-hidden="true"></i> {{ row.error }}
                  </td>
                } @else {
                  <td class="c-date et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
                  <td class="c-desc">
                    @if (row.duplicate) {
                      <p-tag
                        value="Duplikát"
                        severity="secondary"
                        class="dup-tag"
                        pTooltip="Tento pohyb už na účte máš, pri importe sa preskočí"
                        tooltipPosition="top"
                      />
                    }
                    {{ row.description || row.counterparty || '—' }}
                  </td>
                  <td class="c-cat">
                    @if (row.categoryName) {
                      <span
                        class="et-dot"
                        [style.background]="row.categoryColor ?? uncategorised"
                      ></span>
                      {{ row.categoryName }}
                    } @else {
                      <span class="et-faint">Nezaradené</span>
                    }
                  </td>
                  <td class="c-type">
                    @if (row.type) {
                      <app-type-badge [type]="row.type" />
                    }
                  </td>
                  <td
                    class="c-amount et-right et-num"
                    [class.et-out]="row.type === 'EXPENSE'"
                    [class.et-in]="row.type === 'INCOME'"
                  >
                    {{ row.type === 'EXPENSE' ? '−' : '+' }}{{ row.amount | currency: 'EUR' }}
                  </td>
                }
              </tr>
            </ng-template>
          </p-table>

          <div class="confirm-row">
            <p-button label="Zrušiť" severity="secondary" [text]="true" (onClick)="reset()" />
            <p-button
              [label]="importLabel(data)"
              icon="pi pi-check"
              [loading]="importing()"
              [disabled]="!selectedAccountId() || !importableRows(data) || previewing()"
              (onClick)="confirm()"
            />
          </div>
        </section>
      }
    }

    <section class="et-panel history" aria-labelledby="history-head">
      <h2 id="history-head" class="et-eyebrow et-panel-head">História importov</h2>

      @if (batches.error()) {
        <app-error-state
          heading="Históriu sa nepodarilo načítať"
          [error]="batches.error()"
          (retry)="batches.reload()"
        />
      } @else if (!batches.hasValue()) {
        <app-list-skeleton [rows]="3" />
      } @else if (!batchRows().length) {
        <app-empty-state
          class="compact"
          icon="pi pi-history"
          heading="Zatiaľ žiadne importy"
          message="Po prvom importe tu uvidíš, kedy a čo si nahral."
        />
      } @else {
        <p-table [value]="batchRows()" size="small">
          <ng-template #header>
            <tr>
              <th scope="col">Súbor</th>
              <th scope="col" class="col-when">Kedy</th>
              <th scope="col" class="et-right">Uložených</th>
              <th scope="col" class="et-right col-dups">Duplikátov</th>
              <th scope="col" class="col-status">Stav</th>
              <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr>
              <td class="filename">
                <span class="et-truncate">{{ row.filename }}</span>
                <span class="when-inline et-faint et-num">{{
                  row.importedAt | date: 'dd.MM.yyyy HH:mm'
                }}</span>
              </td>
              <td class="col-when et-num et-muted">
                {{ row.importedAt | date: 'dd.MM.yyyy HH:mm' }}
              </td>
              <td class="et-right et-num">{{ row.rowCount }}</td>
              <td class="et-right et-num et-muted col-dups">{{ row.duplicateCount }}</td>
              <td class="col-status">
                <p-tag [value]="statusLabel(row)" [severity]="statusSeverity(row)" />
              </td>
              <td class="et-actions">
                <p-button
                  icon="pi pi-undo"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  [loading]="undoing() === row.id"
                  [disabled]="undoing() !== null"
                  [ariaLabel]="'Vrátiť import ' + row.filename"
                  pTooltip="Vrátiť import"
                  tooltipPosition="left"
                  (onClick)="confirmUndo(row)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>
  `,
  styles: `
    .step {
      margin-bottom: var(--et-s4);
    }

    .step-head {
      display: flex;
      align-items: center;
      gap: var(--et-s3);
      margin: 0 0 var(--et-s4);
      font-size: 1rem;
    }

    .step-no {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border: 1px solid var(--et-kept);
      border-radius: 50%;
      font-size: 0.75rem;
      color: var(--et-kept);
    }

    .upload-row {
      display: flex;
      align-items: flex-end;
      gap: var(--et-s3) var(--et-s4);
      flex-wrap: wrap;
    }

    .account {
      flex: 1 1 14rem;
      max-width: 22rem;
    }

    .file {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
      margin: var(--et-s3) 0 0;
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: var(--et-s2);
      margin-bottom: var(--et-s3);
    }

    .confirm-row {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: var(--et-s2);
      margin-top: var(--et-s4);
    }

    .duplicate-row td {
      opacity: 0.5;
    }

    .duplicate-row .c-desc {
      opacity: 0.75;
    }

    :host ::ng-deep .dup-tag {
      margin-right: var(--et-s2);
      font-size: 0.6875rem;
    }

    .invalid-row {
      background: color-mix(in srgb, var(--p-red-500) 8%, transparent);
    }

    .error-cell {
      color: var(--p-red-300);
      font-size: 0.875rem;
    }

    .line-col {
      width: 3.5rem;
      color: var(--et-faint);
    }

    .c-cat .et-dot {
      margin-right: var(--et-s2);
    }

    .c-amount {
      font-weight: 500;
    }

    .filename {
      max-width: 20rem;
    }

    .filename .et-truncate {
      display: block;
    }

    .when-inline {
      display: none;
      font-size: 0.75rem;
    }

    @media (max-width: 720px) {
      .col-when,
      .col-dups,
      .col-status {
        display: none;
      }

      .when-inline {
        display: block;
      }

      .filename {
        max-width: 11rem;
      }

      .step tr:not(.invalid-row) {
        grid-template-columns: 2rem minmax(0, 1fr) auto;
        grid-template-areas:
          'line desc amount'
          'line date type'
          'line cat cat';
      }

      tr.invalid-row {
        grid-template-columns: 2rem minmax(0, 1fr);
      }

      .line-col {
        align-self: start;
        width: auto;
      }

      tr:not(.invalid-row) .line-col {
        grid-area: line;
      }

      .c-desc {
        grid-area: desc;
        font-weight: 500;
      }

      .c-amount {
        grid-area: amount;
      }

      .c-date {
        grid-area: date;
        font-size: 0.8125rem;
        color: var(--et-faint);
      }

      .c-type {
        grid-area: type;
        justify-self: end;
      }

      .c-cat {
        grid-area: cat;
        font-size: 0.8125rem;
      }
    }
  `,
})
export class ImportComponent {
  private readonly importService = inject(ImportService);
  private readonly accountService = inject(AccountService);
  private readonly feedback = inject(FeedbackService);

  private readonly uploader = viewChild(FileUpload);

  protected readonly uncategorised = UNCATEGORISED_COLOR;
  protected readonly accounts = this.accountService.accounts;
  protected readonly accountsLoad = rxResource({ stream: () => this.accountService.load() });
  protected readonly batches = rxResource({ stream: () => this.importService.batches() });
  protected readonly batchRows = computed(() =>
    this.batches.hasValue() ? (this.batches.value() ?? []) : [],
  );

  /** Defaults to the first account; the user's own pick survives until the list changes. */
  protected readonly selectedAccountId = linkedSignal<string | null>(
    () => this.accounts()[0]?.id ?? null,
  );

  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly fileName = signal<string | null>(null);
  protected readonly previewing = signal(false);
  protected readonly importing = signal(false);
  /** Id of the batch being undone, so only its button spins. */
  protected readonly undoing = signal<string | null>(null);

  private selectedFile: File | null = null;
  /** The preview in flight; a newer file or account cancels it so a stale answer never lands. */
  private previewRequest: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelPreview());
  }

  protected onSelect(event: FileUploadHandlerEvent): void {
    const file = event.files[0];
    // Clear PrimeNG's own list so picking the same file again still triggers a preview.
    this.uploader()?.clear();
    if (!file) {
      return;
    }

    this.selectedFile = file;
    this.fileName.set(file.name);
    this.preview.set(null);
    this.loadPreview(file);
  }

  /** Duplicates depend on the target account, so a new account means a fresh preview. */
  protected onAccountChange(accountId: string | null): void {
    this.selectedAccountId.set(accountId);
    if (this.selectedFile) {
      this.loadPreview(this.selectedFile);
    }
  }

  private loadPreview(file: File): void {
    this.cancelPreview();
    this.previewing.set(true);

    this.previewRequest = this.importService.preview(file, this.selectedAccountId()).subscribe({
      next: (preview) => {
        this.previewRequest = null;
        this.preview.set(preview);
        this.previewing.set(false);
      },
      error: (err: unknown) => {
        this.previewRequest = null;
        this.previewing.set(false);
        this.fileName.set(null);
        this.selectedFile = null;
        this.feedback.error('Súbor sa nepodarilo načítať', err, 'Je to CSV export z George?');
      },
    });
  }

  private cancelPreview(): void {
    this.previewRequest?.unsubscribe();
    this.previewRequest = null;
    this.previewing.set(false);
  }

  protected confirm(): void {
    const accountId = this.selectedAccountId();
    if (!this.selectedFile || !accountId) {
      return;
    }

    this.importing.set(true);

    this.importService.confirm(this.selectedFile, accountId).subscribe({
      next: (batch) => {
        const saved = `Uložené: ${batch.rowCount} ${plural(batch.rowCount, 'transakcia', 'transakcie', 'transakcií')}.`;
        const skipped = batch.duplicateCount
          ? ` Preskočené duplikáty: ${batch.duplicateCount}.`
          : '';
        this.feedback.success('Import dokončený', saved + skipped);
        this.importing.set(false);
        this.reset();
        this.batches.reload();
      },
      error: (err: unknown) => {
        this.feedback.error('Import zlyhal', err);
        this.importing.set(false);
      },
    });
  }

  protected reset(): void {
    this.cancelPreview();
    this.preview.set(null);
    this.fileName.set(null);
    this.selectedFile = null;
  }

  protected rowsLabel(count: number): string {
    return `${count} ${plural(count, 'riadok', 'riadky', 'riadkov')}`;
  }

  /** Valid rows minus the ones the account already holds; only these get saved. */
  protected importableRows(data: ImportPreview): number {
    return Math.max(0, data.validRows - data.duplicateRows);
  }

  protected duplicatesLabel(count: number): string {
    return `${count} ${plural(count, 'duplikát', 'duplikáty', 'duplikátov')}, preskočia sa`;
  }

  protected confirmUndo(batch: ImportBatch): void {
    const n = batch.rowCount;
    this.feedback.confirmDestructive({
      header: 'Vrátiť import?',
      message: `Zmaže sa ${n} ${plural(n, 'transakcia', 'transakcie', 'transakcií')} zo súboru „${batch.filename}“, aj keď si ich medzitým upravil. Ak neskorší import tieto riadky preskočil ako duplikáty, zmiznú tiež — po vrátení ich môžeš naimportovať znova.`,
      acceptLabel: 'Vrátiť import',
      accept: () => {
        this.undoing.set(batch.id);
        this.importService.undo(batch.id).subscribe({
          next: ({ deletedTransactions: deleted }) => {
            this.undoing.set(null);
            this.feedback.success(
              'Import vrátený',
              `Zmazané: ${deleted} ${plural(deleted, 'transakcia', 'transakcie', 'transakcií')}.`,
            );
            this.batches.reload();
          },
          error: (err: unknown) => {
            this.undoing.set(null);
            this.feedback.error('Import sa nepodarilo vrátiť', err);
          },
        });
      },
    });
  }

  protected importLabel(data: ImportPreview): string {
    const n = this.importableRows(data);
    return `Importovať ${n} ${plural(n, 'transakciu', 'transakcie', 'transakcií')}`;
  }

  protected statusLabel(batch: ImportBatch): string {
    return IMPORT_STATUS_LABELS[batch.status];
  }

  protected statusSeverity(batch: ImportBatch): TagSeverity {
    return STATUS_SEVERITY[batch.status];
  }
}
