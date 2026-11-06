import { Injectable, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';

import { errorMessage } from './http-error';

export interface DestructiveConfirm {
  header: string;
  message: string;
  acceptLabel?: string;
  accept: () => void;
}

/**
 * The single way screens talk back to the user: toasts for the outcome of a mutation and a
 * confirmation dialog before anything is destroyed. Both hosts live once, in the root App.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  success(summary: string, detail?: string): void {
    this.messages.add({ severity: 'success', summary, detail, life: 3000 });
  }

  info(summary: string, detail?: string): void {
    this.messages.add({ severity: 'info', summary, detail, life: 4000 });
  }

  /** Shows the server's ProblemDetail `detail` when there is one, else the fallback. */
  error(summary: string, error: unknown, fallback = 'Skús to znova.'): void {
    this.messages.add({
      severity: 'error',
      summary,
      detail: errorMessage(error, fallback),
      life: 6000,
    });
  }

  confirmDestructive(options: DestructiveConfirm): void {
    this.confirmation.confirm({
      header: options.header,
      message: options.message,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: options.acceptLabel ?? 'Zmazať',
      rejectLabel: 'Zrušiť',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      defaultFocus: 'reject',
      accept: options.accept,
    });
  }
}
