import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { CategoryRuleService } from '../../core/api/category-rule.service';
import { CategoryService } from '../../core/api/category.service';
import { TransactionService } from '../../core/api/transaction.service';
import { CategoryRule, CategoryRuleRequest } from '../../core/models';
import { plural } from '../../core/labels';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { UNCATEGORISED_COLOR } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { TypeBadgeComponent } from '../../shared/type-badge.component';
import { RuleDialogComponent } from './rule-dialog.component';

/** Lower-case and strip accents, the same folding the backend matches with. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-rules',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    ToggleSwitchModule,
    TooltipModule,
    EmptyStateComponent,
    ErrorStateComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    TypeBadgeComponent,
    RuleDialogComponent,
  ],
  host: {
    '(document:keydown)': 'onShortcut($event)',
  },
  template: `
    <app-page-header
      eyebrow="Nastavenia"
      heading="Pravidlá"
      description="Pravidlo priradí kategóriu každej transakcii, ktorej popis obsahuje zadaný text. Používa sa pri importe aj pri dodatočnom zaraďovaní."
    >
      <p-button
        label="Použiť pravidlá na nekategorizované"
        icon="pi pi-sparkles"
        severity="secondary"
        [text]="true"
        [loading]="categorising()"
        pTooltip="Zaradí transakcie, ktoré ešte nemajú kategóriu. Zaradené nechá tak."
        tooltipPosition="bottom"
        (onClick)="categorise()"
      />
      <p-button
        label="Pridať pravidlo"
        icon="pi pi-plus"
        pTooltip="Nové pravidlo (N)"
        tooltipPosition="bottom"
        (onClick)="openCreate()"
      />
    </app-page-header>

    @if (list.error() && !list.hasValue()) {
      <app-error-state
        heading="Pravidlá sa nepodarilo načítať"
        [error]="list.error()"
        (retry)="list.reload()"
      />
    } @else if (!list.hasValue()) {
      <div class="et-panel"><app-list-skeleton [rows]="6" /></div>
    } @else if (!rules().length) {
      <div class="et-panel">
        @if (!categories().length && !lookups.isLoading()) {
          <app-empty-state
            icon="pi pi-tags"
            heading="Najprv si vytvor kategórie"
            message="Pravidlo hovorí, do ktorej kategórie transakcia patrí. Odporúčané kategórie prídu aj s pravidlami pre bežné obchody."
          >
            <a pButton routerLink="/categories"
              ><i class="pi pi-tags" aria-hidden="true"></i>Prejsť na kategórie</a
            >
          </app-empty-state>
        } @else {
          <app-empty-state
            icon="pi pi-sitemap"
            heading="Zatiaľ nemáš žiadne pravidlá"
            message="Napríklad „LIDL“ → Potraviny. Pri ďalšom importe sa každá platba v Lidli zaradí sama."
          >
            <p-button label="Pridať prvé pravidlo" icon="pi pi-plus" (onClick)="openCreate()" />
          </app-empty-state>
        }
      </div>
    } @else {
      <div class="toolbar">
        <p-iconfield class="search">
          <p-inputicon class="pi pi-search" />
          <input
            pInputText
            type="search"
            [value]="search()"
            (input)="onSearch($any($event.target).value)"
            placeholder="Hľadať text alebo kategóriu"
            aria-label="Hľadať v pravidlách"
          />
        </p-iconfield>
        <p class="count et-muted" aria-live="polite">
          @if (search()) {
            <span class="et-num">{{ visibleRules().length }}</span> z
          }
          <span class="et-num">{{ rules().length }}</span> {{ countLabel() }}
          @if (inactiveCount()) {
            <span class="et-faint">· {{ inactiveCount() }} vypnutých</span>
          }
        </p>
      </div>

      <div class="et-panel table-panel">
        <p-table [value]="visibleRules()" dataKey="id" size="small" class="et-stack-table">
          <ng-template #header>
            <tr>
              <th scope="col">Text v popise</th>
              <th scope="col">Kategória</th>
              <th scope="col" class="et-right">Priorita</th>
              <th scope="col">Aktívne</th>
              <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr [class.inactive]="!row.active">
              <td class="c-pattern">
                <span class="pattern et-num">{{ row.pattern }}</span>
              </td>
              <td class="c-cat">
                <span class="cat">
                  <span
                    class="et-dot"
                    [style.background]="row.categoryColor ?? uncategorised"
                  ></span>
                  <span class="et-truncate">{{ row.categoryName }}</span>
                  <app-type-badge class="col-type" [type]="row.categoryType" />
                </span>
              </td>
              <td class="c-prio et-right et-num">
                <span class="prio-label">priorita </span>{{ row.priority }}
              </td>
              <td class="c-active">
                <p-toggleswitch
                  [ngModel]="row.active"
                  (ngModelChange)="toggleActive(row, $event)"
                  [disabled]="pending().has(row.id)"
                  [ariaLabel]="'Pravidlo ' + row.pattern + ' je aktívne'"
                />
              </td>
              <td class="c-actions et-actions">
                <p-button
                  icon="pi pi-pencil"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="'Upraviť pravidlo ' + row.pattern"
                  (onClick)="dialog().open(row)"
                />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="'Zmazať pravidlo ' + row.pattern"
                  (onClick)="confirmDelete(row)"
                />
              </td>
            </tr>
          </ng-template>

          <ng-template #emptymessage>
            <tr class="empty-row">
              <td colspan="5">
                <app-empty-state
                  icon="pi pi-search"
                  [heading]="'Nič nezodpovedá „' + search() + '“'"
                  message="Hľadá sa v texte pravidla aj v názve kategórie."
                >
                  <p-button
                    label="Zrušiť hľadanie"
                    icon="pi pi-times"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="onSearch('')"
                  />
                </app-empty-state>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <app-rule-dialog [categories]="categories()" (saved)="list.reload()" />
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--et-s3) var(--et-s4);
      margin-bottom: var(--et-s3);
    }

    .search {
      flex: 0 1 22rem;
    }

    .search input {
      width: 100%;
    }

    .count {
      margin: 0;
      font-size: 0.875rem;
    }

    .table-panel {
      padding: var(--et-s2) var(--et-s3);
    }

    .pattern {
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .cat {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
      min-width: 0;
      max-width: 100%;
    }

    .prio-label {
      display: none;
    }

    tr.inactive .pattern,
    tr.inactive .cat {
      opacity: 0.5;
    }

    .empty-row td {
      padding: 0;
    }

    @media (max-width: 980px) {
      .col-type {
        display: none;
      }
    }

    /* Phones: each rule becomes a two-line card. */
    @media (max-width: 720px) {
      .table-panel {
        padding: 0 var(--et-s2);
      }

      tr:not(.empty-row) {
        grid-template-columns: minmax(0, 1fr) auto auto;
        grid-template-areas:
          'pattern pattern active'
          'cat prio actions';
      }

      .c-pattern {
        grid-area: pattern;
      }

      .c-active {
        grid-area: active;
        justify-self: end;
      }

      .c-cat {
        grid-area: cat;
        min-width: 0;
        font-size: 0.8125rem;
        color: var(--et-muted);
      }

      .c-prio {
        grid-area: prio;
        font-size: 0.75rem;
        color: var(--et-faint);
      }

      .prio-label {
        display: inline;
      }

      .c-actions {
        grid-area: actions;
        margin-right: -0.5rem;
      }

      .empty-row {
        display: block !important;
      }
    }
  `,
})
export class RulesComponent {
  private readonly router = inject(Router);
  private readonly ruleService = inject(CategoryRuleService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactions = inject(TransactionService);
  private readonly feedback = inject(FeedbackService);

  protected readonly dialog = viewChild.required(RuleDialogComponent);
  protected readonly uncategorised = UNCATEGORISED_COLOR;

  /** `?q=` keeps the search across reloads and back navigation. */
  readonly q = input<string>();

  protected readonly categories = this.categoryService.categories;
  protected readonly lookups = rxResource({ stream: () => this.categoryService.load() });
  protected readonly list = rxResource({ stream: () => this.ruleService.list() });

  /** Server list, patched in place by the active toggle so the row does not flicker. */
  protected readonly rules = linkedSignal<CategoryRule[]>(() =>
    this.list.hasValue() ? this.list.value() : [],
  );

  /**
   * What is typed in the search box. Follows the URL, except when the URL only lost whitespace the
   * user is still typing around ("kaufland " → q=kaufland), which would otherwise eat the space.
   */
  protected readonly search = linkedSignal<string, string>({
    source: () => this.q() ?? '',
    computation: (q, previous) => (previous && previous.value.trim() === q ? previous.value : q),
  });
  protected readonly pending = signal<ReadonlySet<string>>(new Set());
  protected readonly categorising = signal(false);

  protected readonly visibleRules = computed(() => {
    const needle = fold(this.search().trim());
    if (!needle) {
      return this.rules();
    }
    return this.rules().filter(
      (rule) => fold(rule.pattern).includes(needle) || fold(rule.categoryName).includes(needle),
    );
  });

  protected readonly inactiveCount = computed(() => this.rules().filter((r) => !r.active).length);

  protected readonly countLabel = computed(() =>
    plural(this.rules().length, 'pravidlo', 'pravidlá', 'pravidiel'),
  );

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

  protected openCreate(): void {
    this.dialog().open(null);
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    void this.router.navigate([], {
      queryParams: { q: value.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected toggleActive(rule: CategoryRule, active: boolean): void {
    const payload: CategoryRuleRequest = {
      pattern: rule.pattern,
      categoryId: rule.categoryId,
      priority: rule.priority,
      active,
    };
    this.setPending(rule.id, true);
    this.patch({ ...rule, active });

    this.ruleService.update(rule.id, payload).subscribe({
      next: (updated) => {
        this.setPending(rule.id, false);
        this.patch(updated);
        this.feedback.success(active ? 'Pravidlo zapnuté' : 'Pravidlo vypnuté', rule.pattern);
      },
      error: (err: unknown) => {
        this.setPending(rule.id, false);
        this.patch(rule);
        this.feedback.error('Pravidlo sa nepodarilo zmeniť', err);
      },
    });
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
        } else {
          this.feedback.info('Nič ďalšie sa podľa pravidiel zaradiť nedalo');
        }
      },
      error: (err: unknown) => {
        this.categorising.set(false);
        this.feedback.error('Zaradenie podľa pravidiel zlyhalo', err);
      },
    });
  }

  protected confirmDelete(rule: CategoryRule): void {
    this.feedback.confirmDestructive({
      header: 'Zmazať pravidlo?',
      message: `Pravidlo „${rule.pattern}“ → ${rule.categoryName} sa odstráni. Už zaradené transakcie zostanú, ako sú.`,
      accept: () =>
        this.ruleService.remove(rule.id).subscribe({
          next: () => {
            this.feedback.success('Pravidlo zmazané', rule.pattern);
            this.list.reload();
          },
          error: (err: unknown) => this.feedback.error('Pravidlo sa nepodarilo zmazať', err),
        }),
    });
  }

  private patch(rule: CategoryRule): void {
    this.rules.update((rules) => rules.map((r) => (r.id === rule.id ? rule : r)));
  }

  private setPending(id: string, on: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
