import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { Params, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { AccountService } from '../../core/api/account.service';
import { CategoryService } from '../../core/api/category.service';
import { TransactionFilter, TransactionService } from '../../core/api/transaction.service';
import { BulkRequest, Page, Transaction } from '../../core/models';
import { isTransactionType, plural } from '../../core/labels';
import { monthRange, parseIsoDate } from '../../core/date-utils';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { UNCATEGORISED_COLOR } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { RuleDialogComponent } from '../rules/rule-dialog.component';
import { TransactionDialogComponent } from './transaction-dialog.component';
import { FilterChange, TransactionFiltersComponent } from './transaction-filters.component';

const PAGE_SIZE = 25;

/** p-select cannot hold `null` as a real option, so "no category" gets a sentinel id. */
const NO_CATEGORY = '__none__';

/** `attachment; filename="x.csv"` or RFC 5987 `filename*=UTF-8''x.csv`. */
function filenameFrom(response: HttpResponse<Blob>, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // Fall through to the plain parameter.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** Every filter lives in the URL so it survives reload, back and a shared link. */
type QueryKey =
  'from' | 'to' | 'category' | 'sub' | 'account' | 'type' | 'q' | 'all' | 'page' | 'add';

@Component({
  selector: 'app-transactions',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    SelectModule,
    TableModule,
    TooltipModule,
    EmptyStateComponent,
    ErrorStateComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    RuleDialogComponent,
    TransactionDialogComponent,
    TransactionFiltersComponent,
  ],
  host: {
    '(document:keydown)': 'onShortcut($event)',
  },
  template: `
    <app-page-header eyebrow="Pohyby" heading="Transakcie">
      <p-button
        label="Prekategorizovať"
        icon="pi pi-sparkles"
        severity="secondary"
        [text]="true"
        [loading]="categorising()"
        pTooltip="Zaradí nezaradené transakcie podľa pravidiel"
        tooltipPosition="bottom"
        (onClick)="categorise()"
      />
      <p-button
        label="Exportovať CSV"
        icon="pi pi-download"
        severity="secondary"
        [outlined]="true"
        [loading]="exporting()"
        [disabled]="!totalRecords()"
        pTooltip="Stiahne všetky transakcie podľa aktuálnych filtrov"
        tooltipPosition="bottom"
        (onClick)="exportCsv()"
      />
      <p-button
        label="Pridať"
        icon="pi pi-plus"
        pTooltip="Nová transakcia (N)"
        tooltipPosition="bottom"
        (onClick)="openCreate()"
      />
    </app-page-header>

    <app-transaction-filters
      [value]="filter()"
      [accounts]="accounts()"
      [categories]="categories()"
      [filtered]="isFiltered()"
      (changed)="applyFilter($event)"
      (reset)="resetFilters()"
    />

    @if (result.error()) {
      <app-error-state
        heading="Transakcie sa nepodarilo načítať"
        [error]="result.error()"
        (retry)="result.reload()"
      />
    } @else if (!currentPage()) {
      <div class="et-panel"><app-list-skeleton [rows]="8" /></div>
    } @else {
      <p class="count" aria-live="polite">
        <span class="et-num">{{ totalRecords() }}</span> {{ countLabel() }}
        @if (periodLabel(); as label) {
          <span class="et-faint">za {{ label }}</span>
        }
      </p>

      @if (selection().length) {
        <div class="bulk-bar" role="region" aria-label="Hromadné úpravy">
          <span class="bulk-count">
            Vybraté: <strong class="et-num">{{ selection().length }}</strong>
          </span>
          <p-button
            label="Zmeniť kategóriu"
            icon="pi pi-tag"
            severity="secondary"
            [outlined]="true"
            size="small"
            [disabled]="bulkBusy()"
            (onClick)="openBulkCategory()"
          />
          <p-button
            label="Zmazať"
            icon="pi pi-trash"
            severity="danger"
            [outlined]="true"
            size="small"
            [loading]="bulkBusy() && bulkAction() === 'DELETE'"
            [disabled]="bulkBusy()"
            (onClick)="confirmBulkDelete()"
          />
          <p-button
            label="Zrušiť výber"
            severity="secondary"
            [text]="true"
            size="small"
            (onClick)="selection.set([])"
          />
        </div>
      }

      <div class="et-panel table-panel">
        <p-table
          [value]="rows()"
          [selection]="selection()"
          (selectionChange)="selection.set($event)"
          [lazy]="true"
          [lazyLoadOnInit]="false"
          [paginator]="totalRecords() > pageSize"
          [rows]="pageSize"
          [first]="filter().page * pageSize"
          [totalRecords]="totalRecords()"
          [loading]="result.isLoading()"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="{first}–{last} z {totalRecords}"
          (onPage)="onPage($event)"
          dataKey="id"
          size="small"
          class="et-stack-table"
        >
          <ng-template #header>
            <tr>
              <th scope="col" class="c-check">
                <p-table-header-checkbox ariaLabel="Vybrať všetky na tejto strane" />
              </th>
              <th scope="col">Dátum</th>
              <th scope="col">Popis</th>
              <th scope="col">Kategória</th>
              <th scope="col" class="col-account">Účet</th>
              <th scope="col" class="col-source">Zdroj</th>
              <th scope="col" class="et-right">Suma</th>
              <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr [class.selected]="isSelected(row)">
              <td class="c-check">
                <p-table-checkbox
                  [value]="row"
                  [ariaLabel]="'Vybrať ' + (row.description || 'transakciu bez popisu')"
                />
              </td>
              <td class="c-date et-num">{{ row.date | date: 'dd.MM.yyyy' }}</td>
              <td class="c-desc">
                <span class="desc-text">{{ row.description || 'Bez popisu' }}</span>
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
              <td class="c-account col-account">{{ row.accountName }}</td>
              <td class="c-source col-source">
                <span class="source">{{ row.source === 'IMPORT' ? 'Import' : 'Ručne' }}</span>
              </td>
              <td
                class="c-amount et-right et-num"
                [class.et-in]="row.type === 'INCOME'"
                [class.et-out]="row.type === 'EXPENSE'"
              >
                <span class="sr-only">{{ row.type === 'EXPENSE' ? 'výdavok' : 'príjem' }} </span>
                {{ row.type === 'EXPENSE' ? '−' : '+' }}{{ row.amount | currency: 'EUR' }}
              </td>
              <td class="c-actions et-actions">
                <p-button
                  icon="pi pi-bolt"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Vytvoriť pravidlo z popisu"
                  pTooltip="Vytvoriť pravidlo"
                  tooltipPosition="left"
                  (onClick)="createRule(row)"
                />
                <p-button
                  icon="pi pi-pencil"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Upraviť transakciu"
                  (onClick)="dialog().open(row)"
                />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Zmazať transakciu"
                  (onClick)="confirmDelete(row)"
                />
              </td>
            </tr>
          </ng-template>

          <ng-template #emptymessage>
            <tr class="empty-row">
              <td colspan="8">
                @if (isFiltered()) {
                  <app-empty-state
                    icon="pi pi-filter"
                    heading="Pre tieto filtre tu nič nie je"
                    [message]="
                      filter().q
                        ? 'Skús iný text alebo celé obdobie, prípadne filtre zruš.'
                        : 'Skús iné obdobie alebo filtre zruš.'
                    "
                  >
                    <p-button
                      label="Zrušiť filtre"
                      icon="pi pi-filter-slash"
                      severity="secondary"
                      [outlined]="true"
                      (onClick)="resetFilters()"
                    />
                    <p-button
                      label="Celé obdobie"
                      severity="secondary"
                      [text]="true"
                      (onClick)="showAllTime()"
                    />
                  </app-empty-state>
                } @else if (!accounts().length) {
                  <app-empty-state
                    icon="pi pi-credit-card"
                    heading="Najprv si vytvor účet"
                    message="Každá transakcia patrí k nejakému účtu, napríklad k bežnému účtu v banke."
                  >
                    <a pButton routerLink="/accounts"
                      ><i class="pi pi-plus" aria-hidden="true"></i>Vytvoriť účet</a
                    >
                  </app-empty-state>
                } @else {
                  <app-empty-state
                    icon="pi pi-list"
                    [heading]="'Za ' + (periodLabel() ?? 'toto obdobie') + ' zatiaľ nič'"
                    message="Naimportuj výpis z banky alebo pridaj transakciu ručne."
                  >
                    <a pButton routerLink="/import"
                      ><i class="pi pi-upload" aria-hidden="true"></i>Importovať výpis</a
                    >
                    <p-button
                      label="Pridať ručne"
                      icon="pi pi-plus"
                      severity="secondary"
                      [outlined]="true"
                      (onClick)="openCreate()"
                    />
                  </app-empty-state>
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <app-transaction-dialog
      [accounts]="accounts()"
      [categories]="categories()"
      (saved)="result.reload()"
    />

    <app-rule-dialog [categories]="categories()" />

    <p-dialog
      [header]="'Zmeniť kategóriu ' + selection().length + ' ' + selectionLabel()"
      [(visible)]="bulkDialogVisible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(26rem, calc(100vw - 1.5rem))' }"
    >
      <form class="et-form" (ngSubmit)="applyBulkCategory()" novalidate>
        <div class="et-field">
          <label for="bulk-category">Nová kategória</label>
          <p-select
            inputId="bulk-category"
            name="bulkCategory"
            [(ngModel)]="bulkCategoryId"
            [options]="bulkCategoryOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Vyber kategóriu"
            [filter]="bulkCategoryOptions().length > 8"
            filterBy="name"
            appendTo="body"
            [fluid]="true"
          >
            <ng-template #item let-option>
              <span class="option">
                <span
                  class="et-dot"
                  [style.background]="
                    option.id === noCategory ? 'transparent' : (option.color ?? uncategorised)
                  "
                  [class.hollow]="option.id === noCategory"
                ></span>
                {{ option.name }}
              </span>
            </ng-template>
          </p-select>
          @if (mixedTypes()) {
            <small class="hint">
              Výber obsahuje výdavky aj príjmy — kategóriu nastav zvlášť.
            </small>
          }
        </div>
        <div class="et-form-actions">
          <p-button
            label="Zrušiť"
            severity="secondary"
            [text]="true"
            (onClick)="bulkDialogVisible.set(false)"
          />
          <p-button
            type="submit"
            label="Zmeniť kategóriu"
            [disabled]="!bulkCategoryId()"
            [loading]="bulkBusy()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .count {
      margin: 0 0 var(--et-s2);
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .table-panel {
      padding: var(--et-s2) var(--et-s3);
    }

    .bulk-bar {
      position: sticky;
      top: var(--et-s2);
      z-index: 2;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--et-s2) var(--et-s3);
      margin-bottom: var(--et-s2);
      padding: var(--et-s2) var(--et-s3);
      border: 1px solid color-mix(in srgb, var(--et-kept) 45%, var(--et-line));
      border-radius: var(--et-radius-sm);
      background: color-mix(in srgb, var(--et-kept) 8%, var(--et-surface));
    }

    .bulk-count {
      margin-right: auto;
      font-size: 0.875rem;
    }

    .c-check {
      width: 2.5rem;
    }

    /* Three row actions instead of the usual two. */
    .et-actions {
      width: 8.5rem;
    }

    .option {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
    }

    .et-dot.hollow {
      border: 1px solid var(--et-faint);
    }

    .hint {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .c-desc {
      max-width: 22rem;
    }

    .desc-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .c-cat .et-dot {
      margin-right: var(--et-s2);
    }

    .c-cat,
    .c-account {
      white-space: nowrap;
    }

    .c-amount {
      font-weight: 500;
    }

    .source {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .empty-row td {
      padding: 0;
    }

    @media (max-width: 1180px) {
      .col-source {
        display: none !important;
      }
    }

    @media (max-width: 980px) {
      .col-account {
        display: none !important;
      }
    }

    /* Phones: each row becomes a two-line card. */
    @media (max-width: 720px) {
      .table-panel {
        padding: 0 var(--et-s2);
      }

      tr:not(.empty-row) {
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas:
          'check desc amount'
          'check cat actions'
          'check date actions';
      }

      .c-check {
        grid-area: check;
        width: auto;
      }

      .bulk-bar {
        top: 3.75rem;
      }

      .c-desc {
        grid-area: desc;
        max-width: none;
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

      .c-cat {
        grid-area: cat;
        font-size: 0.8125rem;
        color: var(--et-muted);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .c-actions {
        grid-area: actions;
        width: auto;
        margin-right: -0.375rem;
      }

      /* Three icon buttons share the row with date and category; keep them compact. */
      .c-actions ::ng-deep .p-button {
        width: 2rem;
        height: 2rem;
      }

      .empty-row {
        display: block !important;
      }
    }
  `,
})
export class TransactionsComponent {
  private readonly router = inject(Router);
  private readonly transactions = inject(TransactionService);
  private readonly accountService = inject(AccountService);
  private readonly categoryService = inject(CategoryService);
  private readonly feedback = inject(FeedbackService);
  private readonly injector = inject(Injector);

  protected readonly dialog = viewChild.required(TransactionDialogComponent);

  protected readonly uncategorised = UNCATEGORISED_COLOR;
  protected readonly pageSize = PAGE_SIZE;

  // Query params, bound by the router (withComponentInputBinding).
  readonly from = input<string>();
  readonly to = input<string>();
  readonly category = input<string>();
  /** `sub=1`: the category filter also matches its subcategories (budget links use it). */
  readonly sub = input<string>();
  readonly account = input<string>();
  readonly type = input<string>();
  readonly q = input<string>();
  readonly all = input<string>();
  readonly page = input<string>();
  readonly add = input<string>();

  protected readonly accounts = this.accountService.accounts;
  protected readonly categories = this.categoryService.categories;
  protected readonly categorising = signal(false);
  protected readonly exporting = signal(false);

  protected readonly ruleDialog = viewChild.required(RuleDialogComponent);
  protected readonly noCategory = NO_CATEGORY;

  /** Rows ticked on the current page; cleared whenever the filter or page changes. */
  protected readonly selection = signal<Transaction[]>([]);
  protected readonly bulkDialogVisible = signal(false);
  protected readonly bulkCategoryId = signal<string | null>(null);
  protected readonly bulkAction = signal<BulkRequest['action'] | null>(null);
  protected readonly bulkBusy = computed(() => this.bulkAction() !== null);

  private readonly selectedIds = computed(() => new Set(this.selection().map((row) => row.id)));

  protected readonly mixedTypes = computed(
    () => new Set(this.selection().map((row) => row.type)).size > 1,
  );

  /**
   * "Bez kategórie" first, then the categories facing the same way as the whole selection. The API
   * rejects a category whose type differs from any selected row, so a mixed selection can only be
   * cleared.
   */
  protected readonly bulkCategoryOptions = computed(() => {
    const types = new Set(this.selection().map((row) => row.type));
    const only = types.size === 1 ? [...types][0] : null;
    const categories = only
      ? this.categories()
          .filter((category) => category.type === only)
          .sort((a, b) => a.name.localeCompare(b.name, 'sk'))
      : [];
    return [
      { id: NO_CATEGORY, name: 'Bez kategórie', color: null as string | null },
      ...categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ];
  });

  protected readonly selectionLabel = computed(() =>
    plural(this.selection().length, 'transakcie', 'transakcií', 'transakcií'),
  );

  /** Accounts and categories feed the filters and the dialog; failures surface as a toast. */
  private readonly lookups = rxResource({
    stream: () => forkJoin([this.accountService.load(), this.categoryService.load()]),
  });

  /** No dates in the URL means "this month", unless the user explicitly asked for all time. */
  protected readonly filter = computed(() => {
    const allTime = this.all() === '1';
    const hasRange = !!(this.from() || this.to());
    const month = monthRange(new Date());
    // The URL counts pages from 1, the API from 0.
    const pageNumber = Math.max(0, (Math.floor(Number(this.page() ?? 1)) || 1) - 1);
    const type = this.type();
    const categoryId = this.category() ?? null;

    return {
      from: hasRange ? (this.from() ?? null) : allTime ? null : month.from,
      to: hasRange ? (this.to() ?? null) : allTime ? null : month.to,
      categoryId,
      includeSubcategories: !!categoryId && this.sub() === '1',
      accountId: this.account() ?? null,
      type: isTransactionType(type) ? type : null,
      q: this.q()?.trim() || null,
      page: pageNumber,
      size: PAGE_SIZE,
    } satisfies TransactionFilter & { page: number };
  });

  protected readonly isFiltered = computed(
    () =>
      !!(
        this.from() ||
        this.to() ||
        this.all() ||
        this.category() ||
        this.account() ||
        this.type() ||
        this.q()
      ),
  );

  protected readonly result = rxResource({
    params: () => this.filter(),
    stream: ({ params }) => this.transactions.search(params),
  });

  /** Keeps the last page on screen while the next one loads, so paging does not flash. */
  protected readonly currentPage = linkedSignal<
    Page<Transaction> | undefined,
    Page<Transaction> | undefined
  >({
    source: () => (this.result.hasValue() ? this.result.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly rows = computed(() => this.currentPage()?.content ?? []);
  protected readonly totalRecords = computed(() => this.currentPage()?.totalElements ?? 0);

  protected readonly countLabel = computed(() =>
    plural(this.totalRecords(), 'transakcia', 'transakcie', 'transakcií'),
  );

  protected readonly periodLabel = computed(() => {
    const { from, to } = this.filter();
    const start = parseIsoDate(from);
    const end = parseIsoDate(to);
    if (!start || !end) {
      return null;
    }
    const month = monthRange(start);
    if (from === month.from && to === month.to) {
      return start.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
    }
    const format = (d: Date) => d.toLocaleDateString('sk-SK');
    return `${format(start)} – ${format(end)}`;
  });

  constructor() {
    // Deleting the last rows of the last page leaves the URL past the end; step back to the new
    // last page instead of showing an empty table under a non-empty count.
    effect(() => {
      const page = this.result.hasValue() ? this.result.value() : undefined;
      if (page && page.content.length === 0 && page.number > 0 && page.totalElements > 0) {
        const last = Math.max(1, page.totalPages);
        untracked(() => this.navigate({ page: last > 1 ? String(last) : null }, true));
      }
    });

    // A different page or filter shows different rows; a stale selection would be invisible.
    effect(() => {
      this.filter();
      untracked(() => this.selection.set([]));
    });

    effect(() => {
      const error = this.lookups.error();
      if (error) {
        untracked(() => this.feedback.error('Účty a kategórie sa nepodarilo načítať', error));
      }
    });

    // `?add=1` (from the dashboard's empty state) opens the dialog once, then leaves the URL.
    effect(() => {
      if (this.add()) {
        // Wait for the first render so the dialog's view query is resolved.
        afterNextRender(
          () => {
            this.openCreate();
            this.navigate({ add: null }, true);
          },
          { injector: this.injector },
        );
      }
    });
  }

  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'n' && !shouldIgnoreShortcut(event)) {
      event.preventDefault();
      this.openCreate();
    }
  }

  protected openCreate(): void {
    this.dialog().open(null);
  }

  protected applyFilter(change: FilterChange): void {
    // A new or cleared category starts without subcategories unless the change says otherwise.
    const sub = 'category' in change && !('sub' in change) ? { sub: null } : {};
    this.navigate({ ...change, ...sub, page: null });
  }

  protected showAllTime(): void {
    this.navigate({ from: null, to: null, all: '1', page: null });
  }

  protected resetFilters(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected onPage(event: TablePageEvent): void {
    const page = Math.floor(event.first / event.rows);
    this.navigate({ page: page > 0 ? String(page + 1) : null });
  }

  protected categorise(): void {
    this.categorising.set(true);

    this.transactions.categorise().subscribe({
      next: ({ updated }) => {
        this.categorising.set(false);
        if (updated) {
          this.feedback.success(
            `Zaradil som ${updated} ${plural(updated, 'transakciu', 'transakcie', 'transakcií')}`,
          );
          this.result.reload();
        } else {
          this.feedback.info('Nič ďalšie sa podľa pravidiel zaradiť nedalo');
        }
      },
      error: (err: unknown) => {
        this.categorising.set(false);
        this.feedback.error('Prekategorizovanie zlyhalo', err);
      },
    });
  }

  protected isSelected(row: Transaction): boolean {
    return this.selectedIds().has(row.id);
  }

  protected createRule(row: Transaction): void {
    this.ruleDialog().open(null, {
      pattern: row.description,
      categoryId: row.categoryId,
      type: row.type,
    });
  }

  protected exportCsv(): void {
    const { page: _page, size: _size, ...filter } = this.filter();
    this.exporting.set(true);

    this.transactions.exportCsv(filter).subscribe({
      next: (response) => {
        this.exporting.set(false);
        if (!response.body) {
          this.feedback.error('Export zlyhal', null, 'Server poslal prázdny súbor.');
          return;
        }
        const url = URL.createObjectURL(response.body);
        const link = document.createElement('a');
        link.href = url;
        link.download = filenameFrom(response, 'transakcie.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Give the browser a moment to start the download before the URL goes away.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.feedback.success('Export pripravený', link.download);
      },
      error: (err: unknown) => {
        this.exporting.set(false);
        this.feedback.error('Export zlyhal', err);
      },
    });
  }

  protected openBulkCategory(): void {
    // A mixed selection can only be cleared, so that is the one choice to preselect.
    this.bulkCategoryId.set(this.mixedTypes() ? NO_CATEGORY : null);
    this.bulkDialogVisible.set(true);
  }

  protected applyBulkCategory(): void {
    const choice = this.bulkCategoryId();
    if (!choice) {
      return;
    }
    const request: BulkRequest = {
      ids: this.selection().map((row) => row.id),
      action: 'SET_CATEGORY',
      ...(choice === NO_CATEGORY ? {} : { categoryId: choice }),
    };
    this.runBulk(request, (n) => `Kategória zmenená: ${this.countOf(n)}`);
  }

  protected confirmBulkDelete(): void {
    const ids = this.selection().map((row) => row.id);
    const n = ids.length;
    this.feedback.confirmDestructive({
      header: `Zmazať ${this.countOf(n)}?`,
      message: `Natrvalo sa odstráni: ${this.countOf(n)}. Vrátiť sa to nedá.`,
      acceptLabel: `Zmazať ${n}`,
      accept: () =>
        this.runBulk({ ids, action: 'DELETE' }, (affected) => `Zmazané: ${this.countOf(affected)}`),
    });
  }

  private runBulk(request: BulkRequest, done: (affected: number) => string): void {
    this.bulkAction.set(request.action);

    this.transactions.bulk(request).subscribe({
      next: ({ affected }) => {
        this.bulkAction.set(null);
        this.bulkDialogVisible.set(false);
        this.selection.set([]);
        this.feedback.success(done(affected));
        this.result.reload();
      },
      error: (err: unknown) => {
        this.bulkAction.set(null);
        this.feedback.error('Hromadná úprava zlyhala', err, 'Nič sa nezmenilo. Skús to znova.');
      },
    });
  }

  private countOf(n: number): string {
    return `${n} ${plural(n, 'transakcia', 'transakcie', 'transakcií')}`;
  }

  protected confirmDelete(row: Transaction): void {
    const amount = row.amount.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
    this.feedback.confirmDestructive({
      header: 'Zmazať transakciu?',
      message: `${row.description || 'Transakcia bez popisu'} (${amount}) sa natrvalo odstráni.`,
      accept: () =>
        this.transactions.remove(row.id).subscribe({
          next: () => {
            this.feedback.success('Transakcia zmazaná');
            this.result.reload();
          },
          error: (err: unknown) => this.feedback.error('Transakciu sa nepodarilo zmazať', err),
        }),
    });
  }

  private navigate(params: Partial<Record<QueryKey, string | null>>, replace = false): void {
    const queryParams: Params = params;
    void this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: replace,
    });
  }
}
