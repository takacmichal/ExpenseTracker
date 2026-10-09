import { Component, DestroyRef, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import { Account, Category, TransactionType } from '../../core/models';
import { TRANSACTION_TYPE_OPTIONS } from '../../core/labels';
import { parseIsoDate, toIsoDate } from '../../core/date-utils';

export interface ActiveFilter {
  from: string | null;
  to: string | null;
  categoryId: string | null;
  accountId: string | null;
  type: TransactionType | null;
  q: string | null;
  /** The category filter also matches its subcategories (`sub=1`). */
  includeSubcategories?: boolean;
}

/** How long typing has to pause before the search reaches the URL (and the API). */
export const SEARCH_DEBOUNCE_MS = 300;

/** A change to the URL query params; `null` removes a param. */
export type FilterChange = Partial<
  Record<'from' | 'to' | 'all' | 'category' | 'sub' | 'account' | 'type' | 'q', string | null>
>;

/** The filter bar above the transactions table. Stateless: the URL is the source of truth. */
@Component({
  selector: 'app-transaction-filters',
  imports: [
    FormsModule,
    ButtonModule,
    DatePickerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
  ],
  template: `
    <section class="filters et-panel" aria-label="Filtre">
      <div class="filter search">
        <label for="f-search" class="et-eyebrow">Hľadať</label>
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input
            pInputText
            id="f-search"
            type="search"
            [value]="searchDraft()"
            (input)="onSearchInput($any($event.target).value)"
            (keydown.enter)="flushSearch()"
            [maxLength]="searchMaxLength"
            placeholder="Popis alebo typ platby"
            autocomplete="off"
            [fluid]="true"
          />
        </p-iconfield>
      </div>

      <div class="filter range">
        <label for="f-range" class="et-eyebrow">Obdobie</label>
        <p-datepicker
          inputId="f-range"
          [ngModel]="rangeDraft()"
          (ngModelChange)="onRangeChange($event)"
          (onClearClick)="changed.emit({ from: null, to: null, all: '1' })"
          selectionMode="range"
          dateFormat="dd.mm.yy"
          placeholder="Celé obdobie"
          [readonlyInput]="true"
          [showIcon]="true"
          [showButtonBar]="true"
          [fluid]="true"
        />
      </div>

      <div class="filter">
        <label for="f-category" class="et-eyebrow">Kategória</label>
        <p-select
          inputId="f-category"
          [ngModel]="value().categoryId"
          (ngModelChange)="changed.emit({ category: $event || null, sub: null })"
          [options]="categories()"
          optionLabel="name"
          optionValue="id"
          placeholder="Všetky"
          [showClear]="true"
          [filter]="categories().length > 8"
          filterBy="name"
          [fluid]="true"
        />
        @if (value().includeSubcategories) {
          <span class="sub-chip">
            vrátane podkategórií
            <button
              type="button"
              class="sub-chip-remove"
              aria-label="Bez podkategórií"
              title="Bez podkategórií"
              (click)="changed.emit({ sub: null })"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </span>
        }
      </div>

      <div class="filter">
        <label for="f-account" class="et-eyebrow">Účet</label>
        <p-select
          inputId="f-account"
          [ngModel]="value().accountId"
          (ngModelChange)="changed.emit({ account: $event || null })"
          [options]="accounts()"
          optionLabel="name"
          optionValue="id"
          placeholder="Všetky"
          [showClear]="true"
          [fluid]="true"
        />
      </div>

      <div class="filter">
        <label for="f-type" class="et-eyebrow">Typ</label>
        <p-select
          inputId="f-type"
          [ngModel]="value().type"
          (ngModelChange)="changed.emit({ type: $event || null })"
          [options]="typeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Všetky"
          [showClear]="true"
          [fluid]="true"
        />
      </div>

      @if (filtered()) {
        <p-button
          class="reset"
          label="Zrušiť filtre"
          icon="pi pi-filter-slash"
          severity="secondary"
          [text]="true"
          (onClick)="reset.emit()"
        />
      }
    </section>
  `,
  styles: `
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
      align-items: end;
      gap: var(--et-s3) var(--et-s4);
      margin-bottom: var(--et-s4);
      padding: var(--et-s4);
    }

    .filter {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 0;
    }

    .search {
      grid-column: span 2;
    }

    .sub-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      align-self: flex-start;
      padding: 0.0625rem 0.25rem 0.0625rem 0.5rem;
      border: 1px solid var(--et-line);
      border-radius: 999px;
      font-size: 0.75rem;
      color: var(--et-muted);
    }

    .sub-chip-remove {
      display: inline-grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .sub-chip-remove .pi {
      font-size: 0.625rem;
    }

    .sub-chip-remove:hover {
      color: var(--et-text);
    }

    .reset {
      justify-self: start;
    }

    /* Phones: search and period get a full row each, the three selects pair up beneath them. */
    @media (max-width: 720px) {
      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--et-s3);
        padding: var(--et-s3);
      }

      .range,
      .search {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class TransactionFiltersComponent {
  readonly value = input.required<ActiveFilter>();
  readonly accounts = input.required<Account[]>();
  readonly categories = input.required<Category[]>();
  /** Whether anything differs from the default view, which shows the reset button. */
  readonly filtered = input(false);

  readonly changed = output<FilterChange>();
  readonly reset = output<void>();

  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;
  /** Mirrors the backend limit (SearchText.MAX_LENGTH). */
  protected readonly searchMaxLength = 100;

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * What is typed in the search box. Follows the URL, except when the URL only lost whitespace the
   * user is still typing around ("kaufland " → q=kaufland), which would otherwise eat the space.
   */
  protected readonly searchDraft = linkedSignal<string | null, string>({
    source: () => this.value().q,
    computation: (q, previous) =>
      previous && previous.value.trim() === (q ?? '') ? previous.value : (q ?? ''),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  protected onSearchInput(text: string): void {
    this.searchDraft.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.flushSearch(), SEARCH_DEBOUNCE_MS);
  }

  /** Pushes the typed text to the URL now; Enter skips the debounce. */
  protected flushSearch(): void {
    clearTimeout(this.searchTimer);
    const q = this.searchDraft().trim() || null;
    if (q !== this.value().q) {
      this.changed.emit({ q });
    }
  }

  /** The date picker's own state; only pushed to the URL once both ends are picked. */
  protected readonly rangeDraft = linkedSignal<(Date | null)[] | null>(() => {
    const { from, to } = this.value();
    const start = parseIsoDate(from);
    return start ? [start, parseIsoDate(to) ?? start] : null;
  });

  protected onRangeChange(range: (Date | null)[] | null): void {
    this.rangeDraft.set(range);
    const [start, end] = range ?? [];
    if (start && end) {
      this.changed.emit({ from: toIsoDate(start), to: toIsoDate(end), all: null });
    }
  }
}
