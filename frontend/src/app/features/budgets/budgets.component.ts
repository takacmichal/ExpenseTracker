import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { BudgetService } from '../../core/api/budget.service';
import { CategoryService } from '../../core/api/category.service';
import { BudgetRequest, BudgetStatus } from '../../core/models';
import { isSameMonth, monthRange, parseMonthKey, toMonthKey } from '../../core/date-utils';
import { plural } from '../../core/labels';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { UNCATEGORISED_COLOR } from '../../theme';
import { BudgetMeterComponent } from '../../shared/budget-meter.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { MonthSwitcherComponent } from '../../shared/month-switcher.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** p-select cannot hold `null` as a real option, so the overall budget gets a sentinel id. */
const OVERALL = '__overall__';

interface CategoryOption {
  id: string;
  name: string;
  color?: string;
  overall: boolean;
}

@Component({
  selector: 'app-budgets',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    SelectModule,
    SkeletonModule,
    TooltipModule,
    BudgetMeterComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FieldErrorComponent,
    MonthSwitcherComponent,
    PageHeaderComponent,
  ],
  host: {
    '(document:keydown)': 'onShortcut($event)',
  },
  template: `
    <app-page-header eyebrow="Rozpočty" [heading]="monthLabel()">
      <app-month-switcher [month]="selectedMonth()" (changed)="navigateTo($event)" />
      @if (budgets().length) {
        <p-button
          label="Pridať rozpočet"
          icon="pi pi-plus"
          pTooltip="Nový rozpočet (N)"
          tooltipPosition="bottom"
          (onClick)="openCreate()"
        />
      }
    </app-page-header>

    @if (report.error() && !report.hasValue()) {
      <app-error-state
        heading="Rozpočty sa nepodarilo načítať"
        [error]="report.error()"
        (retry)="report.reload()"
      />
    } @else if (!report.hasValue()) {
      <div class="grid" aria-busy="true" aria-label="Načítava sa">
        @for (i of [0, 1, 2]; track i) {
          <div class="et-panel">
            <p-skeleton width="40%" height="1rem" />
            <p-skeleton height="0.5rem" class="gap" />
            <p-skeleton width="70%" height="1.25rem" class="gap" />
          </div>
        }
      </div>
    } @else if (!budgets().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-wallet"
          heading="Zatiaľ nemáš žiadny rozpočet"
          message="Nastav si mesačný limit, celkový alebo pre jednotlivé kategórie výdavkov (napr. reštaurácie 150 €). Uvidíš, koľko ti ešte zostáva a či ho pri tomto tempe neprekročíš."
        >
          <p-button label="Pridať prvý rozpočet" icon="pi pi-plus" (onClick)="openCreate()" />
        </app-empty-state>
      </div>
    } @else {
      <p class="summary" aria-live="polite">
        <span
          ><span class="et-num">{{ budgets().length }}</span> {{ budgetsLabel() }}</span
        >
        @if (exceededCount(); as n) {
          <span class="et-out">· {{ n }} {{ exceededLabel() }}</span>
        }
        @if (atRiskCount(); as n) {
          <span class="et-out">· {{ n }} {{ atRiskLabel() }}</span>
        }
        @if (!exceededCount() && !atRiskCount()) {
          <span class="et-kept">· všetko v limite</span>
        }
      </p>

      <div class="grid">
        @for (budget of budgets(); track budget.budgetId) {
          <article class="et-panel card" [class.overall]="!budget.categoryId">
            <app-budget-meter [status]="budget" />
            <div class="card-actions">
              <a
                class="tx-link"
                routerLink="/transactions"
                [queryParams]="transactionsLink(budget)"
                >{{ budget.categoryId ? 'Transakcie' : 'Všetky výdavky' }}</a
              >
              <span class="spacer"></span>
              <p-button
                icon="pi pi-pencil"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                size="small"
                [ariaLabel]="'Upraviť rozpočet ' + nameOf(budget)"
                (onClick)="openEdit(budget)"
              />
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                [rounded]="true"
                size="small"
                [ariaLabel]="'Zmazať rozpočet ' + nameOf(budget)"
                (onClick)="confirmDelete(budget)"
              />
            </div>
          </article>
        }
      </div>

      @if (currentMonthReport()) {
        <p class="note et-faint">
          Odhad na koniec mesiaca predpokladá, že budeš míňať rovnakým tempom ako doteraz. Ryska v
          ukazovateli ukazuje, kam by si sa dostal.
        </p>
      }
    }

    <p-dialog
      [header]="editing() ? 'Upraviť rozpočet' : 'Nový rozpočet'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(28rem, calc(100vw - 1.5rem))' }"
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field">
          <label for="budget-category">Na čo</label>
          <p-select
            inputId="budget-category"
            formControlName="categoryId"
            [options]="categoryOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Vyber kategóriu"
            [filter]="categoryOptions().length > 8"
            filterBy="name"
            appendTo="body"
            [fluid]="true"
            aria-describedby="budget-category-hint"
          >
            <ng-template #item let-option>
              <span class="option" [class.overall-option]="option.overall">
                @if (option.overall) {
                  <i class="pi pi-wallet" aria-hidden="true"></i>
                } @else {
                  <span class="et-dot" [style.background]="option.color ?? uncategorised"></span>
                }
                {{ option.name }}
              </span>
            </ng-template>
          </p-select>
          <small class="hint" id="budget-category-hint">
            Celkový rozpočet stráži všetky výdavky. Rozpočet kategórie zahŕňa aj jej podkategórie.
          </small>
          <app-field-error [control]="form.controls.categoryId" />
        </div>

        <div class="et-field">
          <label for="budget-limit">Mesačný limit</label>
          <p-inputnumber
            inputId="budget-limit"
            formControlName="amountLimit"
            mode="currency"
            currency="EUR"
            locale="sk-SK"
            [min]="0"
            [fluid]="true"
          />
          <app-field-error [control]="form.controls.amountLimit" />
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
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať rozpočet'"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.375rem;
      margin: 0 0 var(--et-s3);
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr));
      gap: var(--et-s4);
      align-items: start;
    }

    .card {
      display: flex;
      flex-direction: column;
      padding: 1.25rem 1.25rem var(--et-s2);
    }

    .card.overall {
      grid-column: 1 / -1;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: var(--et-s1);
      margin-top: var(--et-s2);
      padding-top: var(--et-s2);
      border-top: 1px solid var(--et-surface-2);
    }

    .spacer {
      flex: 1;
    }

    .tx-link {
      font-size: 0.8125rem;
      text-decoration: none;
    }

    .tx-link:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    :host ::ng-deep .gap {
      margin-top: var(--et-s4);
    }

    .note {
      margin: var(--et-s4) 0 0;
      max-width: 44rem;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .option {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
    }

    .overall-option {
      font-weight: 600;
    }

    .overall-option i {
      color: var(--et-kept);
    }

    .hint {
      font-size: 0.75rem;
      color: var(--et-faint);
    }
  `,
})
export class BudgetsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly budgetService = inject(BudgetService);
  private readonly categoryService = inject(CategoryService);
  private readonly feedback = inject(FeedbackService);

  protected readonly uncategorised = UNCATEGORISED_COLOR;

  /** Bound from `?month=YYYY-MM`; absent means the month in progress. */
  readonly month = input<string>();

  protected readonly selectedMonth = computed(() => parseMonthKey(this.month()));

  protected readonly monthLabel = computed(() =>
    this.selectedMonth().toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }),
  );

  protected readonly report = rxResource({
    params: () => this.selectedMonth(),
    stream: ({ params: month }) =>
      this.budgetService.status(month.getFullYear(), month.getMonth() + 1),
  });

  private readonly lookups = rxResource({ stream: () => this.categoryService.load() });

  protected readonly budgets = computed(() =>
    this.report.hasValue() ? this.report.value().budgets : [],
  );

  protected readonly currentMonthReport = computed(
    () => this.report.hasValue() && this.report.value().currentMonth,
  );

  protected readonly exceededCount = computed(
    () => this.budgets().filter((b) => b.exceeded).length,
  );

  protected readonly atRiskCount = computed(
    () =>
      this.budgets().filter(
        (b) => !b.exceeded && b.projectedSpend !== undefined && b.projectedSpend > b.amountLimit,
      ).length,
  );

  protected readonly exceededLabel = computed(() =>
    plural(this.exceededCount(), 'prekročený', 'prekročené', 'prekročených'),
  );

  protected readonly atRiskLabel = computed(() =>
    plural(
      this.atRiskCount(),
      'smeruje k prekročeniu',
      'smerujú k prekročeniu',
      'smeruje k prekročeniu',
    ),
  );

  protected readonly budgetsLabel = computed(() =>
    plural(this.budgets().length, 'rozpočet', 'rozpočty', 'rozpočtov'),
  );

  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<BudgetStatus | null>(null);

  protected readonly form = this.fb.group({
    categoryId: this.fb.control<string | null>(null, Validators.required),
    amountLimit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  /** Expense categories without a budget yet, plus the overall budget if it is free. */
  protected readonly categoryOptions = computed<CategoryOption[]>(() => {
    const current = this.editing();
    const taken = new Set(
      this.budgets()
        .filter((b) => b.budgetId !== current?.budgetId)
        .map((b) => b.categoryId ?? OVERALL),
    );
    const categories = this.categoryService
      .categories()
      .filter((c) => c.type === 'EXPENSE' && !taken.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'sk'))
      .map((c) => ({ id: c.id, name: c.name, color: c.color ?? undefined, overall: false }));
    return taken.has(OVERALL)
      ? categories
      : [{ id: OVERALL, name: 'Celkový rozpočet', overall: true }, ...categories];
  });

  constructor() {
    effect(() => {
      const error = this.lookups.error();
      if (error) {
        untracked(() => this.feedback.error('Kategórie sa nepodarilo načítať', error));
      }
    });
  }

  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'n' && !shouldIgnoreShortcut(event)) {
      event.preventDefault();
      this.openCreate();
    }
  }

  protected navigateTo(month: Date): void {
    const isCurrent = isSameMonth(month, new Date());
    void this.router.navigate([], {
      queryParams: { month: isCurrent ? null : toMonthKey(month) },
      queryParamsHandling: 'merge',
    });
  }

  protected nameOf(budget: BudgetStatus): string {
    return budget.categoryName ?? 'celkový';
  }

  /**
   * The month's expenses behind a budget; the overall budget covers every category. A category
   * budget counts its subcategories too, so the list includes them (`sub=1`) to match the total.
   */
  protected transactionsLink(budget: BudgetStatus): Record<string, string> {
    const { from, to } = monthRange(this.selectedMonth());
    return budget.categoryId
      ? { from, to, category: budget.categoryId, sub: '1', type: 'EXPENSE' }
      : { from, to, type: 'EXPENSE' };
  }

  protected openCreate(): void {
    this.editing.set(null);
    const first = this.categoryOptions()[0];
    this.form.reset({ categoryId: first?.overall ? OVERALL : null, amountLimit: null });
    this.dialogVisible.set(true);
  }

  protected openEdit(budget: BudgetStatus): void {
    this.editing.set(budget);
    this.form.reset({
      categoryId: budget.categoryId ?? OVERALL,
      amountLimit: budget.amountLimit,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { categoryId, amountLimit } = this.form.getRawValue();
    if (categoryId === null || amountLimit === null) {
      return;
    }

    const payload: BudgetRequest =
      categoryId === OVERALL ? { amountLimit } : { categoryId, amountLimit };

    this.saving.set(true);
    const current = this.editing();
    const request = current
      ? this.budgetService.update(current.budgetId, payload)
      : this.budgetService.create(payload);

    request.subscribe({
      next: (budget) => {
        this.feedback.success(
          current ? 'Rozpočet upravený' : 'Rozpočet pridaný',
          budget.categoryName ?? 'Celkový rozpočet',
        );
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.report.reload();
      },
      error: (err: unknown) => {
        this.feedback.error('Rozpočet sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(budget: BudgetStatus): void {
    const name = budget.categoryName ?? 'Celkový rozpočet';
    this.feedback.confirmDestructive({
      header: 'Zmazať rozpočet?',
      message: `Rozpočet „${name}“ sa odstráni. Transakcie zostanú, ako sú.`,
      accept: () =>
        this.budgetService.remove(budget.budgetId).subscribe({
          next: () => {
            this.feedback.success('Rozpočet zmazaný', name);
            this.report.reload();
          },
          error: (err: unknown) => this.feedback.error('Rozpočet sa nepodarilo zmazať', err),
        }),
    });
  }
}
