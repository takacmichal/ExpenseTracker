import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SkeletonModule } from 'primeng/skeleton';

import { UserService } from '../../core/api/user.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { errorMessage } from '../../core/ui/http-error';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

/** The confirmation field must repeat the new password exactly. */
function matchesNewPassword(control: AbstractControl): ValidationErrors | null {
  const expected = control.parent?.get('newPassword')?.value as string | undefined;
  return control.value && expected !== undefined && control.value !== expected
    ? { mismatch: true }
    : null;
}

@Component({
  selector: 'app-settings',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SkeletonModule,
    ErrorStateComponent,
    FieldErrorComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header eyebrow="Nastavenia" heading="Profil a účet" />

    <div class="sections">
      <section class="et-panel" aria-labelledby="profile-head">
        <h2 id="profile-head" class="section-head">Profil</h2>

        @if (profile.error() && !profile.hasValue()) {
          <app-error-state
            heading="Profil sa nepodarilo načítať"
            [error]="profile.error()"
            (retry)="profile.reload()"
          />
        } @else if (!profile.hasValue()) {
          <div class="et-form" aria-busy="true" aria-label="Načítava sa">
            <p-skeleton width="60%" height="1rem" />
            <p-skeleton height="2.5rem" />
          </div>
        } @else {
          <dl class="facts">
            <div>
              <dt class="et-eyebrow">E-mail</dt>
              <dd>{{ profile.value().email }}</dd>
            </div>
            <div>
              <dt class="et-eyebrow">Účet od</dt>
              <dd class="et-num">{{ profile.value().createdAt | date: 'd. M. yyyy' }}</dd>
            </div>
          </dl>

          <form class="et-form" [formGroup]="nameForm" (ngSubmit)="saveName()" novalidate>
            <div class="et-field">
              <label for="settings-name">Meno</label>
              <input
                pInputText
                id="settings-name"
                formControlName="name"
                maxlength="255"
                autocomplete="name"
              />
              <app-field-error [control]="nameForm.controls.name" />
            </div>
            <div class="et-form-actions">
              <p-button
                type="submit"
                label="Uložiť meno"
                [loading]="savingName()"
                [disabled]="nameForm.pristine"
              />
            </div>
          </form>
        }
      </section>

      <section class="et-panel" aria-labelledby="password-head">
        <h2 id="password-head" class="section-head">Zmena hesla</h2>
        <p class="section-note">
          Po zmene hesla sa odhlásia všetky ostatné prihlásenia. Tu zostaneš prihlásený.
        </p>

        <form class="et-form" [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
          <!-- Lets password managers pair the new password with the account. -->
          <input
            type="email"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            autocomplete="username"
            [value]="auth.user()?.email ?? ''"
            readonly
          />

          <div class="et-field">
            <label for="current-password">Súčasné heslo</label>
            <p-password
              inputId="current-password"
              formControlName="currentPassword"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="current-password"
              [fluid]="true"
            />
            <app-field-error [control]="passwordForm.controls.currentPassword" />
          </div>

          <div class="et-field-row">
            <div class="et-field">
              <label for="new-password">Nové heslo</label>
              <p-password
                inputId="new-password"
                formControlName="newPassword"
                [feedback]="false"
                [toggleMask]="true"
                autocomplete="new-password"
                [fluid]="true"
                aria-describedby="new-password-hint"
              />
              <small class="hint" id="new-password-hint">Aspoň 8 znakov.</small>
              <app-field-error [control]="passwordForm.controls.newPassword" />
            </div>

            <div class="et-field">
              <label for="confirm-password">Nové heslo znova</label>
              <p-password
                inputId="confirm-password"
                formControlName="confirmPassword"
                [feedback]="false"
                [toggleMask]="true"
                autocomplete="new-password"
                [fluid]="true"
              />
              <app-field-error [control]="passwordForm.controls.confirmPassword" />
            </div>
          </div>

          <div class="et-form-actions">
            <p-button type="submit" label="Zmeniť heslo" [loading]="savingPassword()" />
          </div>
        </form>
      </section>

      <section class="et-panel danger" aria-labelledby="danger-head">
        <h2 id="danger-head" class="section-head et-out">Zmazať účet</h2>
        <p class="section-note">
          Natrvalo sa zmažú všetky tvoje účty, transakcie, kategórie, pravidlá, rozpočty a výplaty.
          Vrátiť sa to nedá. Ak chceš dáta zachovať, najprv si ich
          <a routerLink="/transactions">exportuj do CSV</a>.
        </p>

        <form class="et-form" [formGroup]="deleteForm" (ngSubmit)="confirmDelete()" novalidate>
          <div class="et-field">
            <label for="delete-password">Potvrď heslom</label>
            <p-password
              inputId="delete-password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="current-password"
              [fluid]="true"
            />
            <app-field-error [control]="deleteForm.controls.password" />
          </div>
          <div class="et-form-actions">
            <p-button
              type="submit"
              label="Zmazať účet natrvalo"
              icon="pi pi-trash"
              severity="danger"
              [loading]="deleting()"
            />
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .sections {
      display: flex;
      flex-direction: column;
      gap: var(--et-s4);
      max-width: 40rem;
    }

    .section-head {
      margin: 0 0 var(--et-s4);
      font-size: 1.0625rem;
    }

    .section-note {
      margin: calc(var(--et-s2) * -1) 0 var(--et-s4);
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--et-muted);
    }

    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--et-s3) var(--et-s6);
      margin: 0 0 var(--et-s4);
    }

    dd {
      margin: 0.125rem 0 0;
      overflow-wrap: anywhere;
    }

    .hint {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .danger {
      border-color: color-mix(in srgb, var(--et-out) 45%, var(--et-line));
    }
  `,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UserService);
  private readonly feedback = inject(FeedbackService);
  protected readonly auth = inject(AuthService);

  protected readonly profile = rxResource({ stream: () => this.users.profile() });

  protected readonly savingName = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly deleting = signal(false);

  protected readonly nameForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    confirmPassword: ['', [Validators.required, matchesNewPassword]],
  });

  protected readonly deleteForm = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  constructor() {
    // Fill the name field once the profile arrives, without clobbering an edit in progress.
    effect(() => {
      if (this.profile.hasValue()) {
        const name = this.profile.value().name;
        untracked(() => {
          if (this.nameForm.pristine) {
            this.nameForm.reset({ name });
          }
        });
      }
    });

    // Editing the new password re-checks the confirmation against it.
    this.passwordForm.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.passwordForm.controls.confirmPassword.updateValueAndValidity());
  }

  protected saveName(): void {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      return;
    }
    const name = this.nameForm.getRawValue().name.trim();
    if (!name) {
      this.nameForm.controls.name.setErrors({ required: true });
      return;
    }

    this.savingName.set(true);
    this.users.updateProfile(name).subscribe({
      next: (profile) => {
        this.savingName.set(false);
        this.nameForm.reset({ name: profile.name });
        this.profile.set(profile);
        this.auth.updateUser({ id: profile.id, email: profile.email, name: profile.name });
        this.feedback.success('Meno uložené', profile.name);
      },
      error: (err: unknown) => {
        this.savingName.set(false);
        this.feedback.error('Meno sa nepodarilo uložiť', err);
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.savingPassword.set(true);
    this.users.changePassword(currentPassword, newPassword).subscribe({
      next: (session) => {
        this.savingPassword.set(false);
        // The old token is revoked server-side; carry on with the one just issued.
        this.auth.acceptSession(session);
        this.passwordForm.reset();
        this.feedback.success('Heslo zmenené', 'Ostatné prihlásenia sa tým ukončili.');
      },
      error: (err: unknown) => {
        this.savingPassword.set(false);
        this.showPasswordError(err, this.passwordForm.controls.currentPassword, 'newPassword');
      },
    });
  }

  protected confirmDelete(): void {
    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }

    this.feedback.confirmDestructive({
      header: 'Zmazať účet natrvalo?',
      message:
        'Všetky tvoje dáta sa nenávratne zmažú a odhlásim ťa. Túto akciu nie je možné vrátiť späť.',
      acceptLabel: 'Zmazať účet',
      accept: () => this.deleteAccount(),
    });
  }

  private deleteAccount(): void {
    const { password } = this.deleteForm.getRawValue();

    this.deleting.set(true);
    this.users.deleteAccount(password).subscribe({
      next: () => {
        this.deleting.set(false);
        this.auth.logout();
        this.feedback.info(
          'Účet zmazaný',
          'Všetky tvoje dáta sú preč. Ďakujeme, že si ho používal.',
        );
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.showPasswordError(err, this.deleteForm.controls.password);
      },
    });
  }

  /**
   * Field errors from the server go next to their field; a wrong password goes under the
   * password the user typed; anything else is a toast.
   */
  private showPasswordError(
    err: unknown,
    passwordControl: AbstractControl,
    fieldErrorControl?: string,
  ): void {
    if (err instanceof HttpErrorResponse && err.status === 400) {
      const body = err.error as { fieldErrors?: Record<string, string> } | null;
      const fieldError = fieldErrorControl ? body?.fieldErrors?.[fieldErrorControl] : undefined;
      if (fieldError && fieldErrorControl) {
        const control = this.passwordForm.get(fieldErrorControl);
        control?.setErrors({ server: fieldError });
        control?.markAsTouched();
        return;
      }
      // e.g. "Aktuálne heslo nie je správne." straight from the server.
      passwordControl.setErrors({ server: errorMessage(err, 'Heslo nie je správne.') });
      passwordControl.markAsTouched();
      return;
    }
    this.feedback.error('Nepodarilo sa to', err);
  }
}
