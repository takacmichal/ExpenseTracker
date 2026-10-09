export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavSection {
  /** Omitted for the first section, which needs no heading. */
  label?: string;
  items: NavItem[];
}

/** The sidebar, top to bottom. New screens add an item here and a route in app.routes.ts. */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Prehľad', icon: 'pi pi-chart-pie', route: '/dashboard' },
      { label: 'Rok a odhad', icon: 'pi pi-chart-line', route: '/year' },
    ],
  },
  {
    label: 'Peniaze',
    items: [
      { label: 'Transakcie', icon: 'pi pi-list', route: '/transactions' },
      { label: 'Výplaty', icon: 'pi pi-briefcase', route: '/incomes' },
      { label: 'Import', icon: 'pi pi-upload', route: '/import' },
    ],
  },
  {
    label: 'Plánovanie',
    items: [
      { label: 'Rozpočty', icon: 'pi pi-wallet', route: '/budgets' },
      { label: 'Opakované platby', icon: 'pi pi-replay', route: '/recurring' },
    ],
  },
  {
    label: 'Nastavenia',
    items: [
      { label: 'Kategórie', icon: 'pi pi-tags', route: '/categories' },
      { label: 'Pravidlá', icon: 'pi pi-sitemap', route: '/rules' },
      { label: 'Účty', icon: 'pi pi-credit-card', route: '/accounts' },
      { label: 'Profil a účet', icon: 'pi pi-user', route: '/settings' },
    ],
  },
];
