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
  selector: 'app-login',
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
      heading="Vitaj späť"
      subtitle="Prihlás sa a pozri sa, kam tento mesiac išli peniaze."
    >
      <form class="et-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="et-field">
          <label for="email">E-mail</label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            inputmode="email"
            [pAutoFocus]="true"
          />
          <app-field-error [control]="form.controls.email" />
        </div>

        <div class="et-field">
          <label for="password">Heslo</label>
          <p-password
            inputId="password"
            formControlName="password"
            autocomplete="current-password"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
          />
          <app-field-error [control]="form.controls.password" />
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }

        <p-button type="submit" label="Prihlásiť sa" [loading]="loading()" [fluid]="true" />
      </form>

      <span authSwitch>Nemáš účet? <a routerLink="/register">Vytvor si ho</a></span>
    </app-auth-card>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (err: unknown) => {
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 401
            ? 'Tento e-mail a heslo spolu nesedia.'
            : errorMessage(err, 'Prihlásenie sa nepodarilo. Skús to znova.'),
        );
        this.loading.set(false);
      },
    });
  }
}
