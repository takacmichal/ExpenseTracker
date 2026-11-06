import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';

import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let feedback: FeedbackService;
  let add: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    add = vi.fn();
    confirm = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MessageService, useValue: { add } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    feedback = TestBed.inject(FeedbackService);
  });

  it('success adds a short-lived success toast', () => {
    feedback.success('Uložené', 'Transakcia bola uložená.');
    expect(add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Uložené',
      detail: 'Transakcia bola uložená.',
      life: 3000,
    });
  });

  it('info adds an info toast', () => {
    feedback.info('Pozor');
    expect(add).toHaveBeenCalledWith({
      severity: 'info',
      summary: 'Pozor',
      detail: undefined,
      life: 4000,
    });
  });

  it('error shows the server ProblemDetail detail', () => {
    const error = new HttpErrorResponse({ status: 409, error: { detail: 'Názov už existuje.' } });
    feedback.error('Uloženie zlyhalo', error);
    expect(add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Uloženie zlyhalo',
      detail: 'Názov už existuje.',
      life: 6000,
    });
  });

  it('error uses the default fallback for unknown errors', () => {
    feedback.error('Uloženie zlyhalo', new Error('x'));
    expect(add.mock.calls[0][0].detail).toBe('Skús to znova.');
  });

  it('error uses a custom fallback when given', () => {
    feedback.error('Zlyhalo', null, 'Iný text.');
    expect(add.mock.calls[0][0].detail).toBe('Iný text.');
  });

  it('confirmDestructive opens a danger confirm focused on reject', () => {
    const accept = vi.fn();
    feedback.confirmDestructive({ header: 'Zmazať účet', message: 'Naozaj?', accept });

    expect(confirm).toHaveBeenCalledTimes(1);
    const options: Confirmation = confirm.mock.calls[0][0];
    expect(options).toMatchObject({
      header: 'Zmazať účet',
      message: 'Naozaj?',
      acceptLabel: 'Zmazať',
      rejectLabel: 'Zrušiť',
      defaultFocus: 'reject',
      acceptButtonProps: { severity: 'danger' },
    });
    expect(accept).not.toHaveBeenCalled();
    options.accept!();
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('confirmDestructive honours a custom accept label', () => {
    feedback.confirmDestructive({
      header: 'h',
      message: 'm',
      acceptLabel: 'Odstrániť',
      accept: () => {},
    });
    expect(confirm.mock.calls[0][0].acceptLabel).toBe('Odstrániť');
  });
});
