import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { AuthService } from '../core/auth/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  template: `
    <div class="shell">
      <aside>
        <div class="brand">
          <span class="mark">SK</span>
          <span class="wordmark">Rozpočet</span>
        </div>

        <nav>
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active">
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="who">
          <div class="avatar">{{ initials() }}</div>
          <div class="who-text">
            <span class="name">{{ auth.user()?.name }}</span>
            <span class="mail">{{ auth.user()?.email }}</span>
          </div>
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            ariaLabel="Odhlásiť sa"
            (onClick)="auth.logout()"
          />
        </div>
      </aside>

      <main>
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: flex;
      min-height: 100vh;
    }

    aside {
      width: 14rem;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.25rem 0.875rem;
      background: var(--et-surface);
      border-right: 1px solid var(--et-line);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0 0.375rem;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 1.875rem;
      height: 1.875rem;
      border-radius: 0.4375rem;
      background: var(--et-kept);
      color: #1a1204;
      font-family: var(--et-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .wordmark {
      font-family: var(--et-sans);
      font-size: 1.0625rem;
      font-weight: 600;
      letter-spacing: -0.015em;
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      flex: 1;
    }

    nav a {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5625rem 0.75rem;
      border-radius: 0.4375rem;
      color: var(--et-muted);
      text-decoration: none;
      font-size: 0.9375rem;
      transition: color 0.15s, background 0.15s;
    }

    nav a i {
      font-size: 0.9375rem;
    }

    nav a:hover {
      color: var(--et-text);
      background: var(--et-surface-2);
    }

    nav a.active {
      color: var(--et-text);
      background: var(--et-surface-2);
    }

    nav a.active i {
      color: var(--et-kept);
    }

    /* An indicator lamp, not a highlight bar: the panel says which circuit is live. */
    nav a.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 0.5rem;
      border-radius: 0 2px 2px 0;
      background: var(--et-kept);
      box-shadow: 0 0 6px rgba(232, 167, 44, 0.55);
    }

    .who {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.5rem 0.25rem;
      border-top: 1px solid var(--et-line);
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--et-surface-2);
      border: 1px solid var(--et-line);
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--et-muted);
    }

    .who-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .name {
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .mail {
      font-size: 0.6875rem;
      color: var(--et-faint);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    main {
      flex: 1;
      min-width: 0;
      padding: 1.75rem 2rem 3rem;
    }

    @media (max-width: 900px) {
      .shell {
        flex-direction: column;
      }

      aside {
        width: 100%;
        flex-direction: row;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-right: none;
        border-bottom: 1px solid var(--et-line);
        overflow-x: auto;
      }

      nav {
        flex-direction: row;
        flex: 1;
      }

      nav a span {
        display: none;
      }

      .who-text,
      .wordmark {
        display: none;
      }

      .who {
        border-top: none;
        padding: 0;
      }

      main {
        padding: 1.25rem 1rem 2rem;
      }
    }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);

  protected readonly navItems: NavItem[] = [
    { label: 'Prehľad', icon: 'pi pi-chart-pie', route: '/dashboard' },
    { label: 'Rok a odhad', icon: 'pi pi-chart-line', route: '/year' },
    { label: 'Transakcie', icon: 'pi pi-list', route: '/transactions' },
    { label: 'Výplaty', icon: 'pi pi-briefcase', route: '/incomes' },
    { label: 'Kategórie', icon: 'pi pi-tags', route: '/categories' },
    { label: 'Účty', icon: 'pi pi-credit-card', route: '/accounts' },
    { label: 'Import', icon: 'pi pi-upload', route: '/import' },
  ];

  protected initials(): string {
    const name = this.auth.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
