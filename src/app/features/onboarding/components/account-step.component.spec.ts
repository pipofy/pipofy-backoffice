import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AccountStepComponent } from './account-step.component';
import { passwordsMatch, trimmedMinLength, PHONE_RE } from '../onboarding.validators';
import { EMAIL_RE } from '@shared/validators/email';

function accountGroup() {
  return new FormGroup({
    nombre: new FormControl('', [Validators.required, trimmedMinLength(2)]),
    apellido: new FormControl('', [Validators.required, trimmedMinLength(2)]),
    email: new FormControl('', [Validators.required, Validators.pattern(EMAIL_RE)]),
    phone: new FormControl('', [Validators.required, Validators.pattern(PHONE_RE)]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirm: new FormControl('', [Validators.required]),
    nombreClub: new FormControl(''),
  }, { validators: [passwordsMatch] });
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(AccountStepComponent);
  fixture.componentRef.setInput('group', accountGroup());
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('AccountStepComponent', () => {
  it('renderiza los campos de la cuenta', async () => {
    const { el } = await render();
    expect(el.querySelector('#nombre')).not.toBeNull();
    expect(el.querySelector('#apellido')).not.toBeNull();
    expect(el.querySelector('#email')).not.toBeNull();
    expect(el.querySelector('#phone')).not.toBeNull();
    expect(el.querySelector('#password')).not.toBeNull();
    expect(el.querySelector('#confirm')).not.toBeNull();
  });

  it('sólo muestra el campo del club cuando role es "club"', async () => {
    const { el } = await render();
    expect(el.querySelector('#nombreClub')).toBeNull();
  });

  it('el toggle cambia el type del input de contraseña', async () => {
    const { fixture, el } = await render();
    const pw = el.querySelector<HTMLInputElement>('#password')!;
    const toggle = el.querySelector<HTMLButtonElement>('.pw-toggle')!;
    expect(pw.type).toBe('password');
    toggle.click();
    await fixture.whenStable();
    expect(pw.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('muestra el medidor de fuerza al tipear', async () => {
    const { fixture, el } = await render();
    const pw = el.querySelector<HTMLInputElement>('#password')!;
    pw.value = 'abcdefgH9!';
    pw.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.pw-meter')).not.toBeNull();
    expect(el.querySelector('.pw-label')?.textContent).toContain('Excelente');
  });
});
