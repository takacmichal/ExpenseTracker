import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state.component';

@Component({
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state heading="Zatiaľ žiadne účty" message="Pridaj prvý účet.">
      <button type="button">Pridať účet</button>
    </app-empty-state>
  `,
})
class HostComponent {}

describe('EmptyStateComponent', () => {
  it('renders heading, default icon and no message when none is given', async () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('heading', 'Nič tu nie je');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.title')?.textContent?.trim()).toBe('Nič tu nie je');
    expect(el.querySelector('.message')).toBeNull();
    expect(el.querySelector('i')?.className).toBe('pi pi-inbox');
  });

  it('renders a custom icon', async () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('heading', 'x');
    fixture.componentRef.setInput('icon', 'pi pi-wallet');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('i').className).toBe('pi pi-wallet');
  });

  it('renders the message and projects the call to action', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.message')?.textContent?.trim()).toBe('Pridaj prvý účet.');
    expect(el.querySelector('.actions button')?.textContent?.trim()).toBe('Pridať účet');
  });
});
