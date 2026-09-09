import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ColorPickerModule } from 'primeng/colorpicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CategoryService } from '../../core/api/category.service';
import { Category, TransactionType } from '../../core/models';
import { chartPalette } from '../../theme';

/** Neutral starting point for a new category, meant to be changed by the user. */
const DEFAULT_COLOR: string = chartPalette.faint;

@Component({
  selector: 'app-categories',
  providers: [ConfirmationService],
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    ColorPickerModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />

    <header class="page-head">
      <div>
        <p class="et-eyebrow">Nastavenia</p>
        <h1>Kategórie</h1>
      </div>
      <div class="head-actions">
        @if (categories().length) {
          <p-button
            label="Doplniť odporúčané"
            icon="pi pi-sparkles"
            severity="secondary"
            [text]="true"
            [loading]="seeding()"
            (onClick)="addDefaults()"
          />
        }
        <p-button label="Pridať" icon="pi pi-plus" (onClick)="openCreate()" />
      </div>
    </header>

    <p-table [value]="categories()" styleClass="p-datatable-sm">
      <ng-template #header>
        <tr>
          <th class="color-col">Farba</th>
          <th>Názov</th>
          <th>Typ</th>
          <th>Nadradená</th>
          <th class="actions-col"></th>
        </tr>
      </ng-template>

      <ng-template #body let-row>
        <tr>
          <td class="color-col">
            <span class="swatch" [style.background]="row.color ?? '#94a3b8'"></span>
          </td>
          <td>
            @if (row.icon) {
              <i [class]="row.icon" class="row-icon"></i>
            }
            {{ row.name }}
          </td>
          <td>
            <p-tag
              [value]="row.type === 'EXPENSE' ? 'Výdavok' : 'Príjem'"
              [severity]="row.type === 'EXPENSE' ? 'danger' : 'success'"
            />
          </td>
          <td>{{ row.parentName ?? '—' }}</td>
          <td class="actions-col">
            <p-button icon="pi pi-pencil" severity="secondary" [text]="true" ariaLabel="Upraviť" (onClick)="openEdit(row)" />
            <p-button icon="pi pi-trash" severity="danger" [text]="true" ariaLabel="Vymazať" (onClick)="confirmDelete(row)" />
          </td>
        </tr>
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td colspan="5" class="empty">
            <p>Zatiaľ nemáš žiadne kategórie.</p>
            <p-button
              label="Pridať odporúčané"
              icon="pi pi-sparkles"
              severity="secondary"
              [outlined]="true"
              [loading]="seeding()"
              (onClick)="addDefaults()"
            />
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="editing() ? 'Upraviť kategóriu' : 'Nová kategória'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '28rem' }"
    >
      <form [formGroup]="form" class="dialog-form">
        <div class="field">
          <label for="name">Názov</label>
          <input pInputText id="name" formControlName="name" />
        </div>

        <div class="field">
          <label for="type">Typ</label>
          <p-select
            inputId="type"
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <div class="field">
          <label>Farba</label>
          <div class="color-row">
            <p-colorpicker formControlName="color" [inline]="false" />
            <input pInputText formControlName="color" class="color-input" />
          </div>
        </div>

        <div class="field">
          <label for="icon">Ikona</label>
          <input pInputText id="icon" formControlName="icon" placeholder="pi pi-shopping-cart" />
          <small>Názov triedy z PrimeIcons.</small>
        </div>

        <div class="field">
          <label for="parentId">Nadradená kategória</label>
          <p-select
            inputId="parentId"
            formControlName="parentId"
            [options]="parentOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Žiadna"
            [showClear]="true"
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

    .field small {
      color: var(--p-text-muted-color);
    }

    .color-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .color-input {
      flex: 1;
    }

    .swatch {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
    }

    .row-icon {
      margin-right: 0.5rem;
      color: var(--p-text-muted-color);
    }

    .color-col {
      width: 4rem;
    }

    .actions-col {
      width: 6rem;
      text-align: right;
      white-space: nowrap;
    }

    .empty {
      text-align: center;
      padding: 2rem 0;
      color: var(--et-muted);
    }

    .empty p {
      margin: 0 0 0.875rem;
    }

    .head-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class CategoriesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly categories = this.categoryService.categories;
  protected readonly dialogVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected readonly seeding = signal(false);

  protected readonly typeOptions = [
    { label: 'Výdavok', value: 'EXPENSE' as TransactionType },
    { label: 'Príjem', value: 'INCOME' as TransactionType },
  ];

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['EXPENSE' as TransactionType, Validators.required],
    color: [DEFAULT_COLOR],
    icon: [''],
    parentId: [null as string | null],
  });

  constructor() {
    this.categoryService.load().subscribe();
  }

  /** A category cannot be its own parent. */
  protected parentOptions() {
    const current = this.editing();
    return this.categories().filter((category) => category.id !== current?.id);
  }

  protected addDefaults(): void {
    this.seeding.set(true);

    this.categoryService.createDefaults().subscribe({
      next: (created) => {
        this.seeding.set(false);
        this.messages.add({
          severity: created.length ? 'success' : 'info',
          summary: created.length ? `Pridaných ${created.length} kategórií` : 'Už ich tam máš všetky',
        });
      },
      error: () => {
        this.seeding.set(false);
        this.messages.add({ severity: 'error', summary: 'Nepodarilo sa pridať kategórie' });
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
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      type: value.type,
      color: this.normalizeColor(value.color),
      icon: value.icon || null,
      parentId: value.parentId,
    };

    const current = this.editing();
    const request = current
      ? this.categoryService.update(current.id, payload)
      : this.categoryService.create(payload);

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

  protected confirmDelete(row: Category): void {
    this.confirmation.confirm({
      header: 'Zmazať kategóriu',
      message: `Naozaj chceš zmazať kategóriu "${row.name}"?`,
      acceptLabel: 'Zmazať',
      rejectLabel: 'Zrušiť',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.categoryService.remove(row.id).subscribe({
          next: () => this.messages.add({ severity: 'success', summary: 'Zmazané' }),
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: 'Nedá sa zmazať',
              detail: err.error?.detail ?? 'Kategória sa používa.',
            }),
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
