import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AutoFocusModule } from 'primeng/autofocus';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/ui/http-error';
import { FieldErrorComponent } from '../../shared/field-error.component';
import { AuthCardComponent } from './auth-card.component';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AutoFocusModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    AuthCardComponent,
    FieldErrorComponent,
  ],
  template: `
    <app-auth-card
      heading="Založ si účet"
      subtitle="Pár sekúnd a môžeš začať sledovať výdavky aj príjmy."
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="et-field">
          <label for="name">Meno</label>
          <input
            pInputText
            id="name"
            formControlName="name"
            autocomplete="name"
            [pAutoFocus]="true"
          />
          <app-field-error [control]="form.controls.name" />
        </div>

        <div class="et-field">
          <label for="email">E-mail</label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            inputmode="email"
          />
          <app-field-error [control]="form.controls.email" />
        </div>

        <div class="et-field">
          <label for="password">Heslo</label>
          <p-password
            inputId="password"
            formControlName="password"
            autocomplete="new-password"
            [toggleMask]="true"
            [fluid]="true"
            promptLabel="Zvoľ si heslo"
          />
          <small class="hint">Aspoň 8 znakov.</small>
          <app-field-error [control]="form.controls.password" />
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }

        <p-button type="submit" label="Vytvoriť účet" [loading]="loading()" [fluid]="true" />
      </form>

      <span authSwitch>Už máš účet? <a routerLink="/login">Prihlás sa</a></span>
    </app-auth-card>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { name, email, password } = this.form.getRawValue();

    this.auth.register(email, password, name).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (err: unknown) => {
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 409
            ? 'Na tento e-mail už účet existuje.'
            : errorMessage(err, 'Účet sa nepodarilo vytvoriť. Skús to znova.'),
        );
        this.loading.set(false);
      },
    });
  }
}
