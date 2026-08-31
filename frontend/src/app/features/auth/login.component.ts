import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="auth et-ledger">
      <div class="card">
        <div class="brand">
          <span class="mark">SK</span>
          <span class="wordmark">Rozpočet</span>
        </div>

        <h1>Vitaj späť</h1>
        <p class="sub">Prihlás sa a pozri sa, kam tento mesiac išli peniaze.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">E-mail</label>
            <input pInputText id="email" type="email" formControlName="email" autocomplete="email" />
          </div>

          <div class="field">
            <label for="password">Heslo</label>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              [inputStyle]="{ width: '100%' }"
              [style]="{ width: '100%' }"
            />
          </div>

          @if (error()) {
            <p-message severity="error">{{ error() }}</p-message>
          }

          <p-button type="submit" label="Prihlásiť sa" [loading]="loading()" [disabled]="form.invalid" [fluid]="true" />
        </form>

        <p class="switch">Nemáš účet? <a routerLink="/register">Vytvor si ho</a></p>
      </div>
    </div>
  `,
  styles: `
    .auth {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 1.5rem;
    }

    .card {
      width: 100%;
      max-width: 22rem;
      padding: 2rem;
      border: 1px solid var(--et-line);
      border-radius: 1rem;
      background: var(--et-surface);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.75rem;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 1.875rem;
      height: 1.875rem;
      border-radius: 0.5rem;
      background: var(--et-brass);
      color: #1a1206;
      font-family: var(--et-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .wordmark {
      font-family: var(--et-display);
      font-size: 1.0625rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .sub {
      margin: 0.375rem 0 1.75rem;
      font-size: 0.9375rem;
      color: var(--et-muted);
      line-height: 1.5;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--et-muted);
    }

    .field input {
      width: 100%;
    }

    .switch {
      margin: 1.5rem 0 0;
      text-align: center;
      font-size: 0.875rem;
      color: var(--et-faint);
    }
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
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set('Tento e-mail a heslo spolu nesedia.');
        this.loading.set(false);
      },
    });
  }
}
