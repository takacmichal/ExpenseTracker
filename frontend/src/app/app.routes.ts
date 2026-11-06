import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Prihlásenie',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Registrácia',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Prehľad',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'year',
        title: 'Rok a odhad',
        loadComponent: () => import('./features/year/year.component').then((m) => m.YearComponent),
      },
      {
        path: 'incomes',
        title: 'Výplaty',
        loadComponent: () =>
          import('./features/incomes/incomes.component').then((m) => m.IncomesComponent),
      },
      {
        path: 'transactions',
        title: 'Transakcie',
        loadComponent: () =>
          import('./features/transactions/transactions.component').then(
            (m) => m.TransactionsComponent,
          ),
      },
      {
        path: 'categories',
        title: 'Kategórie',
        loadComponent: () =>
          import('./features/categories/categories.component').then((m) => m.CategoriesComponent),
      },
      {
        path: 'accounts',
        title: 'Účty',
        loadComponent: () =>
          import('./features/accounts/accounts.component').then((m) => m.AccountsComponent),
      },
      {
        path: 'budgets',
        title: 'Rozpočty',
        loadComponent: () =>
          import('./features/budgets/budgets.component').then((m) => m.BudgetsComponent),
      },
      {
        path: 'recurring',
        title: 'Opakované platby',
        loadComponent: () =>
          import('./features/recurring/recurring.component').then((m) => m.RecurringComponent),
      },
      {
        path: 'rules',
        title: 'Pravidlá',
        loadComponent: () =>
          import('./features/rules/rules.component').then((m) => m.RulesComponent),
      },
      {
        path: 'settings',
        title: 'Profil a účet',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'import',
        title: 'Import',
        loadComponent: () =>
          import('./features/import/import.component').then((m) => m.ImportComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
