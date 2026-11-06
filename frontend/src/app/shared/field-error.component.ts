import { Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';

import { plural } from '../core/labels';

/** Slovak message for the first validation error on a control. */
function describe(errors: ValidationErrors): string {
  if (errors['required']) {
    return 'Toto pole je povinné.';
  }
  if (errors['email']) {
    return 'Zadaj platnú e-mailovú adresu.';
  }
  if (errors['minlength']) {
    const n = errors['minlength'].requiredLength as number;
    return `Zadaj aspoň ${n} ${plural(n, 'znak', 'znaky', 'znakov')}.`;
  }
  if (errors['maxlength']) {
    const n = errors['maxlength'].requiredLength as number;
    return `Najviac ${n} ${plural(n, 'znak', 'znaky', 'znakov')}.`;
  }
  if (errors['min']) {
    return errors['min'].min > 0 ? 'Suma musí byť väčšia ako nula.' : 'Hodnota je príliš malá.';
  }
  if (errors['mismatch']) {
    return 'Heslá sa nezhodujú.';
  }
  if (errors['server']) {
    return String(errors['server']);
  }
  if (errors['pattern']) {
    return 'Hodnota nemá správny formát.';
  }
  return 'Skontroluj túto hodnotu.';
}

/**
 * Validation message under a form field. Appears once the field has been touched (or the
 * form was submitted with markAllAsTouched) and stays in sync through the control's events.
 */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <small class="error" [id]="id()" role="alert">{{ text }}</small>
    }
  `,
  styles: `
    .error {
      display: block;
      font-size: 0.75rem;
      color: var(--et-out);
    }
  `,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl>();
  readonly id = input<string>();

  /** Ticks on every status/touched/value event of the current control. */
  private readonly changes = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.events.pipe(startWith(null)))),
  );

  protected readonly message = computed(() => {
    this.changes();
    const control = this.control();
    if (!control.invalid || !control.touched || !control.errors) {
      return null;
    }
    return describe(control.errors);
  });
}
