import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <p-toast
      position="top-right"
      [breakpoints]="{ '600px': { width: 'auto', left: '0.75rem', right: '0.75rem' } }"
    />
    <p-confirmdialog [style]="{ width: 'min(26rem, calc(100vw - 2rem))' }" />
    <router-outlet />
  `,
})
export class App {}
