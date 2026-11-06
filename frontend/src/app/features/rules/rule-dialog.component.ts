import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { CategoryRuleService } from '../../core/api/category-rule.service';
import {
  Category,
  CategoryRule,
  CategoryRuleRequest,
  RuleTestRequest,
  RuleTestResponse,
  TransactionType,
} from '../../core/models';
import { plural } from '../../core/labels';
import { FeedbackService } from '../../core/ui/feedback.service';
import { errorMessage } from '../../core/ui/http-error';
import { UNCATEGORISED_COLOR } from '../../theme';
import { FieldErrorComponent } from '../../shared/field-error.component';

/** Values a caller can pre-fill when opening the dialog for a new rule. */
export interface RulePrefill {
  pattern?: string | null;
  categoryId?: string | null;
  /** Direction of the transaction the rule comes from; narrows the live test. */
  type?: TransactionType;
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: RuleTestResponse }
  | { kind: 'error'; message: string };

interface CategoryGroup {
  label: string;
  items: Category[];
}

/** Below this many characters a pattern matches too much to be worth testing. */
const MIN_TEST_LENGTH = 2;

/**
 * Create/edit dialog for one categorisation rule, with a live test of the pattern against
 * the user's existing transactions. Used by the rules screen and from a transaction row.
 */
@Component({
  selector: 'app-rule-dialog',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    FieldErrorComponent,
  ],
  template: `
    <p-dialog
      [header]="editing() ? 'Upraviť pravidlo' : 'Nové pravidlo'"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(36rem, calc(100vw - 1.5rem))' }"
    >
      @if (!categories().length) {
        <p class="note">
          Pravidlo priraďuje kategóriu, takže najprv si
          <a routerLink="/categories" (click)="visible.set(false)">vytvor kategórie</a>.
        </p>
      }

      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field">
          <label for="rule-pattern">Text v popise</label>
          <input
            pInputText
            id="rule-pattern"
            class="et-num"
            formControlName="pattern"
            maxlength="255"
            placeholder="napr. LIDL"
            autocomplete="off"
            aria-describedby="rule-pattern-hint"
          />
          <small class="hint" id="rule-pattern-hint">
            Na veľkosti písmen a diakritike nezáleží. Hľadá sa v popise aj v type platby z banky.
          </small>
          <app-field-error [control]="form.controls.pattern" />
        </div>

        <div class="et-field">
          <label for="rule-category">Kategória</label>
          <p-select
            inputId="rule-category"
            formControlName="categoryId"
            [options]="categoryGroups()"
            [group]="true"
            optionGroupLabel="label"
            optionGroupChildren="items"
            optionLabel="name"
            optionValue="id"
            placeholder="Vyber kategóriu"
            [filter]="categories().length > 8"
            filterBy="name"
            appendTo="body"
            [fluid]="true"
          >
            <ng-template #item let-category>
              <span class="option">
                <span class="et-dot" [style.background]="category.color ?? uncategorised"></span>
                {{ category.name }}
              </span>
            </ng-template>
          </p-select>
          <app-field-error [control]="form.controls.categoryId" />
        </div>

        <div class="et-field-row">
          <div class="et-field">
            <label for="rule-priority">Priorita</label>
            <p-inputnumber
              inputId="rule-priority"
              formControlName="priority"
              [useGrouping]="false"
              [showButtons]="true"
              [min]="-1000"
              [max]="1000"
              [fluid]="true"
              aria-describedby="rule-priority-hint"
            />
            <small class="hint" id="rule-priority-hint"
              >Keď sedí viac pravidiel, vyhrá vyššia.</small
            >
          </div>

          <div class="et-field">
            <span class="label" id="rule-active-label">Stav</span>
            <span class="toggle-row">
              <p-toggleswitch formControlName="active" ariaLabelledBy="rule-active-label" />
              <span>{{ form.controls.active.value ? 'Aktívne' : 'Vypnuté' }}</span>
            </span>
          </div>
        </div>

        <section class="test" aria-live="polite" aria-labelledby="rule-test-head">
          <p class="et-eyebrow test-head" id="rule-test-head">Test na tvojich transakciách</p>
          @switch (test().kind) {
            @case ('idle') {
              <p class="test-note">
                Napíš aspoň {{ minTestLength }} znaky a uvidíš, čo pravidlo zachytí.
              </p>
            }
            @case ('loading') {
              <p class="test-note">
                <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Hľadám…
              </p>
            }
            @case ('error') {
              <p class="test-note et-out">{{ testError() }}</p>
            }
            @case ('done') {
              @if (testResult(); as result) {
                @if (result.matchCount) {
                  <p class="test-count">
                    Zachytí <strong class="et-num et-kept">{{ result.matchCount }}</strong>
                    {{ matchLabel(result.matchCount) }}
                    @if (result.matchCount > result.sample.length) {
                      <span class="et-faint">· ukážka najnovších {{ result.sample.length }}</span>
                    }
                  </p>
                  <ul class="sample">
                    @for (tx of result.sample; track tx.id) {
                      <li>
                        <span class="et-num et-faint">{{ tx.date | date: 'dd.MM.yyyy' }}</span>
                        <span class="et-truncate">{{ tx.description || 'Bez popisu' }}</span>
                        <span class="sample-cat et-truncate" [class.et-faint]="!tx.categoryName">
                          {{ tx.categoryName ?? 'Nezaradené' }}
                        </span>
                        <span
                          class="et-num et-right"
                          [class.et-out]="tx.type === 'EXPENSE'"
                          [class.et-in]="tx.type === 'INCOME'"
                          >{{ tx.type === 'EXPENSE' ? '−' : '+'
                          }}{{ tx.amount | currency: 'EUR' }}</span
                        >
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="test-note">Zatiaľ nesedí na žiadnu transakciu.</p>
                }
              }
            }
          }
          <p class="test-foot et-faint">
            Uloženie nezmení už zaradené transakcie. Nezaradené zaradíš tlačidlom „Použiť pravidlá
            na nekategorizované“.
          </p>
        </section>

        <div class="et-form-actions">
          <p-button
            label="Zrušiť"
            severity="secondary"
            [text]="true"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať pravidlo'"
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

    .hint {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .note {
      margin: 0 0 var(--et-s4);
      padding: var(--et-s3);
      border-radius: var(--et-radius-sm);
      background: var(--et-surface-2);
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .option {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
    }

    .toggle-row {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
      min-height: 2.5rem;
      font-size: 0.875rem;
    }

    .test {
      padding: var(--et-s3) var(--et-s4);
      border: 1px solid var(--et-line);
      border-radius: var(--et-radius-sm);
      background: var(--et-surface-2);
    }

    .test p {
      margin: 0;
    }

    .test-head {
      margin-bottom: var(--et-s2) !important;
    }

    .test-note,
    .test-count {
      font-size: 0.875rem;
      color: var(--et-muted);
    }

    .test-foot {
      margin-top: var(--et-s3) !important;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    .sample {
      list-style: none;
      margin: var(--et-s2) 0 0;
      padding: 0;
      max-height: 14rem;
      overflow-y: auto;
    }

    .sample li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(0, 8rem) auto;
      align-items: center;
      gap: var(--et-s3);
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--et-line);
      font-size: 0.8125rem;
    }

    .sample li:last-child {
      border-bottom: none;
    }

    .sample-cat {
      color: var(--et-muted);
    }

    @media (max-width: 520px) {
      .sample li {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .sample li > :first-child,
      .sample-cat {
        display: none;
      }
    }
  `,
})
export class RuleDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rules = inject(CategoryRuleService);
  private readonly feedback = inject(FeedbackService);

  readonly categories = input.required<Category[]>();
  readonly saved = output<CategoryRule>();

  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<CategoryRule | null>(null);
  /** Direction hint from the caller, used for the test until a category is picked. */
  private readonly prefillType = signal<TransactionType | undefined>(undefined);

  protected readonly uncategorised = UNCATEGORISED_COLOR;
  protected readonly minTestLength = MIN_TEST_LENGTH;

  protected readonly form = this.fb.nonNullable.group({
    pattern: ['', [Validators.required, Validators.maxLength(255)]],
    categoryId: [null as string | null, Validators.required],
    priority: [0 as number | null],
    active: [true],
  });

  protected readonly categoryGroups = computed<CategoryGroup[]>(() => {
    const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'sk');
    const all = this.categories();
    return [
      { label: 'Výdavky', items: all.filter((c) => c.type === 'EXPENSE').sort(byName) },
      { label: 'Príjmy', items: all.filter((c) => c.type === 'INCOME').sort(byName) },
    ].filter((group) => group.items.length);
  });

  /** Re-runs the test, debounced, whenever the pattern or the category's direction changes. */
  protected readonly test = toSignal(
    merge(this.form.controls.pattern.valueChanges, this.form.controls.categoryId.valueChanges).pipe(
      map(() => this.testRequest()),
      debounceTime(350),
      distinctUntilChanged((a, b) => a?.pattern === b?.pattern && a?.type === b?.type),
      switchMap((request): Observable<TestState> => {
        if (!request) {
          return of({ kind: 'idle' });
        }
        return this.rules.test(request).pipe(
          map((result): TestState => ({ kind: 'done', result })),
          catchError((err: unknown) =>
            of<TestState>({
              kind: 'error',
              message: errorMessage(err, 'Test sa nepodaril. Skús to znova.'),
            }),
          ),
          startWith<TestState>({ kind: 'loading' }),
        );
      }),
    ),
    { initialValue: { kind: 'idle' } as TestState },
  );

  protected readonly testResult = computed(() => {
    const state = this.test();
    return state.kind === 'done' ? state.result : null;
  });

  protected readonly testError = computed(() => {
    const state = this.test();
    return state.kind === 'error' ? state.message : '';
  });

  open(rule: CategoryRule | null = null, prefill: RulePrefill = {}): void {
    this.editing.set(rule);
    this.prefillType.set(prefill.type);
    this.form.reset(
      rule
        ? {
            pattern: rule.pattern,
            categoryId: rule.categoryId,
            priority: rule.priority,
            active: rule.active,
          }
        : {
            pattern: prefill.pattern?.trim() ?? '',
            categoryId: prefill.categoryId ?? null,
            priority: 0,
            active: true,
          },
    );
    this.visible.set(true);
  }

  protected matchLabel(count: number): string {
    return plural(count, 'transakciu', 'transakcie', 'transakcií');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const pattern = value.pattern.trim();
    if (!pattern) {
      this.form.controls.pattern.setErrors({ required: true });
      this.form.controls.pattern.markAsTouched();
      return;
    }
    if (!value.categoryId) {
      return;
    }

    const payload: CategoryRuleRequest = {
      pattern,
      categoryId: value.categoryId,
      priority: Math.round(value.priority ?? 0),
      active: value.active,
    };

    this.saving.set(true);
    const current = this.editing();
    const request = current ? this.rules.update(current.id, payload) : this.rules.create(payload);

    request.subscribe({
      next: (rule) => {
        this.feedback.success(current ? 'Pravidlo upravené' : 'Pravidlo pridané', rule.pattern);
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit(rule);
      },
      error: (err: unknown) => {
        this.feedback.error('Pravidlo sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }

  private testRequest(): RuleTestRequest | null {
    const pattern = this.form.controls.pattern.value.trim();
    if (pattern.length < MIN_TEST_LENGTH) {
      return null;
    }
    const categoryId = this.form.controls.categoryId.value;
    const category = this.categories().find((c) => c.id === categoryId);
    // A rule only ever categorises transactions facing the same way as its category.
    const type = category?.type ?? this.prefillType();
    return type ? { pattern, type } : { pattern };
  }
}
