import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';

import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  let fixture: ComponentFixture<ErrorStateComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ErrorStateComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('shows the default heading and fallback message as an alert', () => {
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.title')?.textContent?.trim()).toBe('Dáta sa nepodarilo načítať');
    expect(el.querySelector('.message')?.textContent?.trim()).toBe(
      'Skontroluj pripojenie a skús to znova.',
    );
  });

  it('shows the server detail from the error and a custom heading', async () => {
    fixture.componentRef.setInput('heading', 'Transakcie sa nenačítali');
    fixture.componentRef.setInput(
      'error',
      new HttpErrorResponse({ status: 404, error: { detail: 'Účet neexistuje.' } }),
    );
    await fixture.whenStable();

    expect(el.querySelector('.title')?.textContent?.trim()).toBe('Transakcie sa nenačítali');
    expect(el.querySelector('.message')?.textContent?.trim()).toBe('Účet neexistuje.');
  });

  it('shows the unreachable-server message for a network error', async () => {
    fixture.componentRef.setInput('error', new HttpErrorResponse({ status: 0 }));
    await fixture.whenStable();
    expect(el.querySelector('.message')?.textContent).toContain('Server neodpovedá');
  });

  it('emits retry when the button is clicked', async () => {
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    const button = el.querySelector('button');
    expect(button?.textContent).toContain('Skúsiť znova');
    button!.click();
    await fixture.whenStable();

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
