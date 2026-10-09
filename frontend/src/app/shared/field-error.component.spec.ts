import { TestBed, ComponentFixture } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';

import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
  let fixture: ComponentFixture<FieldErrorComponent>;

  async function render(control: FormControl, id?: string) {
    fixture = TestBed.createComponent(FieldErrorComponent);
    fixture.componentRef.setInput('control', control);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();
  }

  function message(): HTMLElement | null {
    return fixture.nativeElement.querySelector('small');
  }

  it('shows nothing for an invalid control that has not been touched', async () => {
    await render(new FormControl('', Validators.required));
    expect(message()).toBeNull();
  });

  it('shows the required message once the control is touched', async () => {
    const control = new FormControl('', Validators.required);
    await render(control);

    control.markAsTouched();
    await fixture.whenStable();

    expect(message()?.textContent?.trim()).toBe('Toto pole je povinné.');
    expect(message()?.getAttribute('role')).toBe('alert');
  });

  it('shows the message when the form is submitted via markAllAsTouched', async () => {
    const control = new FormControl('', Validators.required);
    await render(control);

    control.markAllAsTouched();
    await fixture.whenStable();

    expect(message()).not.toBeNull();
  });

  it('hides the message once the value becomes valid', async () => {
    const control = new FormControl('', Validators.required);
    control.markAsTouched();
    await render(control);
    expect(message()).not.toBeNull();

    control.setValue('ok');
    await fixture.whenStable();

    expect(message()).toBeNull();
  });

  it('updates the message as the error changes', async () => {
    const control = new FormControl('', [Validators.required, Validators.email]);
    control.markAsTouched();
    await render(control);
    expect(message()?.textContent?.trim()).toBe('Toto pole je povinné.');

    control.setValue('not-an-email');
    await fixture.whenStable();

    expect(message()?.textContent?.trim()).toBe('Zadaj platnú e-mailovú adresu.');
  });

  it('binds the id for aria-describedby', async () => {
    const control = new FormControl('', Validators.required);
    control.markAsTouched();
    await render(control, 'email-error');
    expect(message()?.id).toBe('email-error');
  });

  it('follows a newly bound control', async () => {
    const first = new FormControl('', Validators.required);
    await render(first);
    const second = new FormControl('', Validators.required);
    second.markAsTouched();

    fixture.componentRef.setInput('control', second);
    await fixture.whenStable();

    expect(message()).not.toBeNull();
  });

  it.each<[string, FormControl, string]>([
    ['minlength', new FormControl('ab', Validators.minLength(8)), 'Zadaj aspoň 8 znakov.'],
    ['maxlength', new FormControl('abcdef', Validators.maxLength(3)), 'Najviac 3 znaky.'],
    ['min > 0', new FormControl(0, Validators.min(0.01)), 'Suma musí byť väčšia ako nula.'],
    ['min <= 0', new FormControl(-5, Validators.min(0)), 'Hodnota je príliš malá.'],
    [
      'pattern',
      new FormControl('abc', Validators.pattern(/^\d+$/)),
      'Hodnota nemá správny formát.',
    ],
    ['unknown', new FormControl('x', () => ({ custom: true })), 'Skontroluj túto hodnotu.'],
  ])('describes %s in Slovak', async (_, control, expected) => {
    control.markAsTouched();
    await render(control);
    expect(message()?.textContent?.trim()).toBe(expected);
  });
});
