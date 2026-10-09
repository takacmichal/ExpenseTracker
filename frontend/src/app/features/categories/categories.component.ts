import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ColorPickerModule } from 'primeng/colorpicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { CategoryPayload, CategoryService } from '../../core/api/category.service';
import { Category, TransactionType } from '../../core/models';
import { TRANSACTION_TYPE_OPTIONS, plural } from '../../core/labels';
import { FeedbackService } from '../../core/ui/feedback.service';
import { shouldIgnoreShortcut } from '../../core/ui/keyboard';
import { UNCATEGORISED_COLOR } from '../../theme';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** Neutral starting point for a new category, meant to be changed by the user. */
const DEFAULT_COLOR = UNCATEGORISED_COLOR;
const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

interface CategoryGroup {
  type: TransactionType;
  label: string;
  items: Category[];
}

@Component({
  selector: 'app-categories',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    ColorPickerModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
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
      heading="Kategórie"
      description="Podľa kategórií sa delia výdavky na prehľade. Import ich priraďuje automaticky."
    >
      @if (categories().length) {
        <p-button
          label="Doplniť odporúčané"
          icon="pi pi-sparkles"
          severity="secondary"
          [text]="true"
          [loading]="seeding()"
          pTooltip="Pridá chýbajúce predvolené kategórie, existujúce nechá tak"
          tooltipPosition="bottom"
          (onClick)="addDefaults()"
        />
        <p-button
          label="Pridať kategóriu"
          icon="pi pi-plus"
          pTooltip="Nová kategória (N)"
          tooltipPosition="bottom"
          (onClick)="openCreate()"
        />
      }
    </app-page-header>

    @if (list.error() && !categories().length) {
      <app-error-state
        heading="Kategórie sa nepodarilo načítať"
        [error]="list.error()"
        (retry)="list.reload()"
      />
    } @else if (list.isLoading() && !categories().length) {
      <div class="et-panel"><app-list-skeleton [rows]="6" /></div>
    } @else if (!categories().length) {
      <div class="et-panel">
        <app-empty-state
          icon="pi pi-tags"
          heading="Zatiaľ nemáš žiadne kategórie"
          message="Začni odporúčanými (potraviny, bývanie, doprava…) a uprav si ich, alebo si vytvor vlastné."
        >
          <p-button
            label="Pridať odporúčané"
            icon="pi pi-sparkles"
            [loading]="seeding()"
            (onClick)="addDefaults()"
          />
          <p-button
            label="Vytvoriť vlastnú"
            icon="pi pi-plus"
            severity="secondary"
            [outlined]="true"
            (onClick)="openCreate()"
          />
        </app-empty-state>
      </div>
    } @else {
      <div class="groups">
        @for (group of groups(); track group.type) {
          <section class="et-panel table-panel" [attr.aria-labelledby]="'group-' + group.type">
            <h2 class="group-head" [id]="'group-' + group.type">
              <span
                class="et-eyebrow"
                [class.et-out]="group.type === 'EXPENSE'"
                [class.et-in]="group.type === 'INCOME'"
              >
                {{ group.label }}
              </span>
              <span class="et-num et-faint">{{ group.items.length }}</span>
            </h2>

            <p-table [value]="group.items" dataKey="id" size="small">
              <ng-template #header>
                <tr>
                  <th scope="col">Názov</th>
                  <th scope="col" class="col-parent">Nadradená</th>
                  <th scope="col" class="et-actions"><span class="sr-only">Akcie</span></th>
                </tr>
              </ng-template>

              <ng-template #body let-row>
                <tr>
                  <td>
                    <span class="name">
                      <span class="et-dot" [style.background]="row.color ?? uncategorised"></span>
                      @if (row.icon) {
                        <i [class]="row.icon" class="row-icon" aria-hidden="true"></i>
                      }
                      <span class="et-truncate">{{ row.name }}</span>
                    </span>
                  </td>
                  <td class="col-parent et-muted">{{ row.parentName ?? '' }}</td>
                  <td class="et-actions">
                    <p-button
                      icon="pi pi-pencil"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="'Upraviť kategóriu ' + row.name"
                      (onClick)="openEdit(row)"
                    />
                    <p-button
                      icon="pi pi-trash"
                      severity="danger"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="'Zmazať kategóriu ' + row.name"
                      (onClick)="confirmDelete(row)"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </section>
        }
      </div>
    }

    <p-dialog
      [header]="editing() ? 'Upraviť kategóriu' : 'Nová kategória'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(28rem, calc(100vw - 1.5rem))' }"
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="et-field">
          <label for="category-name">Názov</label>
          <input
            pInputText
            id="category-name"
            formControlName="name"
            maxlength="100"
            placeholder="napr. Potraviny"
          />
          <app-field-error [control]="form.controls.name" />
        </div>

        <div class="et-field">
          <span class="label" id="category-type-label">Typ</span>
          <p-selectbutton
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            [fluid]="true"
            ariaLabelledBy="category-type-label"
          />
        </div>

        <div class="et-field-row">
          <div class="et-field">
            <label for="category-color">Farba</label>
            <div class="color-row">
              <p-colorpicker formControlName="color" appendTo="body" />
              <input
                pInputText
                id="category-color"
                formControlName="color"
                class="color-input et-num"
                maxlength="7"
                placeholder="#e8a72c"
              />
            </div>
            <app-field-error [control]="form.controls.color" />
          </div>

          <div class="et-field">
            <label for="category-icon">Ikona <span class="optional">(nepovinné)</span></label>
            <div class="icon-row">
              <span class="icon-preview" aria-hidden="true">
                <i [class]="iconPreview() || 'pi pi-tag'"></i>
              </span>
              <input
                pInputText
                id="category-icon"
                formControlName="icon"
                placeholder="pi pi-shopping-cart"
              />
            </div>
          </div>
        </div>
        <small class="hint">Ikona je názov triedy z PrimeIcons, napr. pi pi-car.</small>

        <div class="et-field">
          <label for="category-parent"
            >Nadradená kategória <span class="optional">(nepovinné)</span></label
          >
          <p-select
            inputId="category-parent"
            formControlName="parentId"
            [options]="parentOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Žiadna"
            [showClear]="true"
            [filter]="parentOptions().length > 8"
            filterBy="name"
            appendTo="body"
            [fluid]="true"
          />
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
            [label]="editing() ? 'Uložiť zmeny' : 'Pridať kategóriu'"
            [loading]="saving()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(26rem, 100%), 1fr));
      gap: var(--et-s4);
      align-items: start;
    }

    .table-panel {
      padding: var(--et-s4) var(--et-s3) var(--et-s2);
    }

    .group-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 0 var(--et-s2) var(--et-s2);
      font-size: inherit;
    }

    .name {
      display: inline-flex;
      align-items: center;
      gap: var(--et-s2);
      min-width: 0;
      max-width: 100%;
      font-weight: 500;
    }

    .row-icon {
      font-size: 0.875rem;
      color: var(--et-faint);
    }

    .label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--et-muted);
    }

    .color-row,
    .icon-row {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
    }

    .color-input,
    .icon-row input {
      flex: 1;
      min-width: 0;
    }

    .icon-preview {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid var(--et-line);
      border-radius: var(--et-radius-sm);
      color: var(--et-muted);
    }

    .hint {
      margin-top: calc(var(--et-s2) * -1);
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    @media (max-width: 480px) {
      .col-parent {
        display: none;
      }
    }
  `,
})
export class CategoriesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly feedback = inject(FeedbackService);

  protected readonly uncategorised = UNCATEGORISED_COLOR;
  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;

  protected readonly categories = this.categoryService.categories;
  protected readonly list = rxResource({ stream: () => this.categoryService.load() });

  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected readonly seeding = signal(false);

  protected readonly groups = computed<CategoryGroup[]>(() => {
    const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'sk');
    const all = this.categories();
    return [
      { type: 'EXPENSE' as const, label: 'Výdavky', items: [] as Category[] },
      { type: 'INCOME' as const, label: 'Príjmy', items: [] as Category[] },
    ]
      .map((group) => ({
        ...group,
        items: all.filter((category) => category.type === group.type).sort(byName),
      }))
      .filter((group) => group.items.length);
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['EXPENSE' as TransactionType, Validators.required],
    color: [DEFAULT_COLOR, Validators.pattern(HEX_COLOR)],
    icon: [''],
    parentId: [null as string | null],
  });

  private readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  protected readonly iconPreview = toSignal(this.form.controls.icon.valueChanges, {
    initialValue: '',
  });

  /** A category cannot be its own parent, and a parent must face the same way. */
  protected readonly parentOptions = computed(() => {
    const current = this.editing();
    const type = this.selectedType();
    return this.categories().filter(
      (category) => category.id !== current?.id && category.type === type,
    );
  });

  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'n' && !shouldIgnoreShortcut(event)) {
      event.preventDefault();
      this.openCreate();
    }
  }

  protected addDefaults(): void {
    this.seeding.set(true);

    this.categoryService.createDefaults().subscribe({
      next: (created) => {
        this.seeding.set(false);
        const n = created.length;
        if (n) {
          this.feedback.success(
            `Pridal som ${n} ${plural(n, 'kategóriu', 'kategórie', 'kategórií')}`,
          );
        } else {
          this.feedback.info('Všetky odporúčané kategórie už máš');
        }
      },
      error: (err: unknown) => {
        this.seeding.set(false);
        this.feedback.error('Odporúčané kategórie sa nepodarilo pridať', err);
      },
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', type: 'EXPENSE', color: DEFAULT_COLOR, icon: '', parentId: null });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: Category): void {
    this.editing.set(row);
    this.form.reset({
      name: row.name,
      type: row.type,
      color: row.color ?? DEFAULT_COLOR,
      icon: row.icon ?? '',
      parentId: row.parentId,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload: CategoryPayload = {
      name: value.name.trim(),
      type: value.type,
      color: this.normalizeColor(value.color),
      icon: value.icon.trim() || null,
      parentId: value.parentId,
    };

    const current = this.editing();
    const request = current
      ? this.categoryService.update(current.id, payload)
      : this.categoryService.create(payload);

    request.subscribe({
      next: () => {
        this.feedback.success(current ? 'Kategória upravená' : 'Kategória pridaná', payload.name);
        this.saving.set(false);
        this.dialogVisible.set(false);
      },
      error: (err: unknown) => {
        this.feedback.error('Kategóriu sa nepodarilo uložiť', err);
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(row: Category): void {
    this.feedback.confirmDestructive({
      header: 'Zmazať kategóriu?',
      message: `Kategória „${row.name}“ sa natrvalo odstráni. Kategóriu, ktorá sa používa, zmazať nejde.`,
      accept: () =>
        this.categoryService.remove(row.id).subscribe({
          next: () => this.feedback.success('Kategória zmazaná', row.name),
          error: (err: unknown) =>
            this.feedback.error('Kategória sa nedá zmazať', err, 'Pravdepodobne sa používa.'),
        }),
    });
  }

  /** p-colorPicker emits a bare hex without the leading hash. */
  private normalizeColor(color: string | null): string | null {
    if (!color) {
      return null;
    }
    return color.startsWith('#') ? color : `#${color}`;
  }
}
