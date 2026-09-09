import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="auth et-grid">
      <div class="card">
        <div class="brand">
          <span class="mark">SK</span>
          <span class="wordmark">Rozpočet</span>
        </div>

        <h1>Založ si účet</h1>
        <p class="sub">Pár sekúnd a môžeš začať sledovať výdavky aj príjmy.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="name">Meno</label>
            <input pInputText id="name" formControlName="name" autocomplete="name" />
          </div>

          <div class="field">
            <label for="email">E-mail</label>
            <input pInputText id="email" type="email" formControlName="email" autocomplete="email" />
          </div>

          <div class="field">
            <label for="password">Heslo</label>
            <p-password
              inputId="password"
              formControlName="password"
              [toggleMask]="true"
              [inputStyle]="{ width: '100%' }"
              [style]="{ width: '100%' }"
            />
            <small>Aspoň 8 znakov.</small>
          </div>

          @if (error()) {
            <p-message severity="error">{{ error() }}</p-message>
          }

          <p-button type="submit" label="Vytvoriť účet" [loading]="loading()" [disabled]="form.invalid" [fluid]="true" />
        </form>

        <p class="switch">Už máš účet? <a routerLink="/login">Prihlás sa</a></p>
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
      background: var(--et-kept);
      color: #1a1206;
      font-family: var(--et-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .wordmark {
      font-family: var(--et-sans);
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

    .field small {
      font-size: 0.75rem;
      color: var(--et-faint);
    }

    .switch {
      margin: 1.5rem 0 0;
      text-align: center;
      font-size: 0.875rem;
      color: var(--et-faint);
    }
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
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { name, email, password } = this.form.getRawValue();

    this.auth.register(email, password, name).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(
          err.status === 409 ? 'Na tento e-mail už účet existuje.' : 'Účet sa nepodarilo vytvoriť.',
        );
        this.loading.set(false);
      },
    });
  }
}
