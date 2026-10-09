import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../core/auth/auth.service';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { NAV_SECTIONS } from './nav';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    TooltipModule,
    BrandMarkComponent,
  ],
  host: {
    '(document:keydown.escape)': 'closeMenu(true)',
  },
  template: `
    <a class="skip" href="#main">Preskočiť na obsah</a>

    <header class="topbar">
      <button
        #menuButton
        type="button"
        class="burger"
        aria-label="Otvoriť menu"
        aria-controls="sidebar"
        [attr.aria-expanded]="menuOpen()"
        (click)="openMenu()"
      >
        <i class="pi pi-bars" aria-hidden="true"></i>
      </button>
      <app-brand-mark />
    </header>

    <div class="shell">
      @if (menuOpen()) {
        <div class="backdrop" aria-hidden="true" (click)="closeMenu()"></div>
      }

      <aside id="sidebar" [class.open]="menuOpen()" aria-label="Hlavná navigácia">
        <div class="brand">
          <app-brand-mark />
          <button type="button" class="close" aria-label="Zavrieť menu" (click)="closeMenu(true)">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>

        <nav #nav>
          @for (section of sections; track $index) {
            <div class="section">
              @if (section.label) {
                <p class="et-eyebrow section-label">{{ section.label }}</p>
              }
              @for (item of section.items; track item.route) {
                <a [routerLink]="item.route" routerLinkActive="active" ariaCurrentWhenActive="page">
                  <i [class]="item.icon" aria-hidden="true"></i>
                  <span>{{ item.label }}</span>
                </a>
              }
            </div>
          }
        </nav>

        <div class="who">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="who-text">
            <span class="name et-truncate">{{ auth.user()?.name }}</span>
            <span class="mail et-truncate">{{ auth.user()?.email }}</span>
          </div>
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            ariaLabel="Odhlásiť sa"
            pTooltip="Odhlásiť sa"
            tooltipPosition="top"
            (onClick)="auth.logout()"
          />
        </div>
      </aside>

      <main id="main" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .skip {
      position: absolute;
      left: var(--et-s3);
      top: -3rem;
      z-index: 1200;
      padding: var(--et-s2) var(--et-s3);
      border-radius: var(--et-radius-sm);
      background: var(--et-kept);
      color: var(--p-primary-contrast-color);
      font-weight: 600;
      text-decoration: none;
    }

    .skip:focus {
      top: var(--et-s3);
    }

    .shell {
      display: flex;
      min-height: 100vh;
    }

    .topbar {
      display: none;
    }

    aside {
      position: sticky;
      top: 0;
      width: 14.5rem;
      height: 100vh;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: var(--et-s5);
      padding: 1.25rem 0.875rem var(--et-s3);
      background: var(--et-surface);
      border-right: 1px solid var(--et-line);
      overflow-y: auto;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0.375rem;
    }

    .close,
    .burger {
      display: none;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: var(--et-radius-sm);
      background: transparent;
      color: var(--et-muted);
      font-size: 1.125rem;
      cursor: pointer;
    }

    .close:hover,
    .burger:hover {
      background: var(--et-surface-2);
      color: var(--et-text);
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: var(--et-s4);
      flex: 1;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .section-label {
      margin: 0 0 var(--et-s1);
      padding: 0 0.75rem;
    }

    nav a {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5625rem 0.75rem;
      border-radius: var(--et-radius-sm);
      color: var(--et-muted);
      text-decoration: none;
      font-size: 0.9375rem;
      transition:
        color 0.15s,
        background 0.15s;
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
      font-weight: 500;
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
      box-shadow: 0 0 6px color-mix(in srgb, var(--et-kept) 55%, transparent);
    }

    .who {
      display: flex;
      align-items: center;
      gap: var(--et-s2);
      padding: 0.625rem var(--et-s2) 0;
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
    }

    main {
      flex: 1;
      min-width: 0;
      max-width: 82rem;
      padding: 1.75rem var(--et-s6) 3rem;
      outline: none;
    }

    .backdrop {
      display: none;
    }

    @media (max-width: 900px) {
      .topbar {
        position: sticky;
        top: 0;
        z-index: 900;
        display: flex;
        align-items: center;
        gap: var(--et-s2);
        height: 3.5rem;
        padding: 0 var(--et-s3);
        background: color-mix(in srgb, var(--et-surface) 92%, transparent);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--et-line);
      }

      .burger,
      .close {
        display: grid;
      }

      aside {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 1000;
        width: min(17rem, 85vw);
        height: 100dvh;
        transform: translateX(-100%);
        visibility: hidden;
        transition:
          transform 0.22s ease,
          visibility 0s linear 0.22s;
        box-shadow: 0 0 2rem rgba(0, 0, 0, 0.5);
      }

      aside.open {
        transform: none;
        visibility: visible;
        transition: transform 0.22s ease;
      }

      .backdrop {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 999;
        background: color-mix(in srgb, var(--et-inset) 65%, transparent);
      }

      main {
        padding: 1.25rem var(--et-s4) var(--et-s6);
      }
    }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');

  protected readonly sections = NAV_SECTIONS;
  protected readonly menuOpen = signal(false);

  protected readonly initials = computed(() =>
    (this.auth.user()?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  constructor() {
    // The drawer is a way to get somewhere; once there, it gets out of the way.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected openMenu(): void {
    this.menuOpen.set(true);
    // Move focus into the drawer so keyboard users land on the first link.
    setTimeout(() => this.nav()?.nativeElement.querySelector<HTMLElement>('a')?.focus(), 50);
  }

  protected closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    if (restoreFocus) {
      this.menuButton()?.nativeElement.focus();
    }
  }
}
