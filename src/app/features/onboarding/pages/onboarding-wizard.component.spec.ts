import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { Registration } from '@domain/entities/registration';
import { ONBOARDING_ROUTES } from '../onboarding.routes';
import { OnboardingSnapshot } from '../onboarding-persistence.service';

@Component({ standalone: true, template: 'revisa tu mail' })
class RevisaStubComponent {}

let recibido: Registration | null = null;

async function harness(
  url = '/onboarding',
  signup: (reg: Registration) => Promise<void> = async (reg) => { recibido = reg; },
) {
  recibido = null;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([
        { path: 'onboarding', children: ONBOARDING_ROUTES },
        { path: 'revisa-tu-mail', component: RevisaStubComponent },
      ]),
      { provide: AuthRepository, useValue: { signup } },
    ],
  });
  const h = await RouterTestingHarness.create();
  await h.navigateByUrl(url);
  return h;
}

function set(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function clickText(root: HTMLElement, text: string): void {
  const btn = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  btn!.click();
}

describe('OnboardingWizardComponent', () => {
  beforeEach(() => sessionStorage.clear());

  it('arranca en el paso de rol y el stepper muestra 3 nodos', async () => {
    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;
    expect(root.querySelector('app-role-step')).toBeTruthy();
    expect(root.querySelectorAll('.stepper li')).toHaveLength(3);
  });

  it('ya no existe el paso de perfil profesional', async () => {
    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;
    root.querySelector<HTMLInputElement>('input[value="profesor"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();
    expect(root.querySelector('app-account-step')).toBeTruthy();
    expect(root.querySelector('app-professional-step')).toBeNull();
  });

  it('el club pide nombre del club dentro del paso Cuenta', async () => {
    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;
    root.querySelector<HTMLInputElement>('input[value="club"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();
    expect(root.querySelector('#nombreClub')).toBeTruthy();
  });

  it('un profesor NO ve el campo de nombre del club', async () => {
    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;
    root.querySelector<HTMLInputElement>('input[value="profesor"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();
    expect(root.querySelector('#nombreClub')).toBeNull();
  });

  it('el flujo completo de club manda el Registration y navega a /revisa-tu-mail', async () => {
    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;

    root.querySelector<HTMLInputElement>('input[value="club"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();

    set(root, '#nombre', 'Martín');
    set(root, '#apellido', 'Rivas');
    set(root, '#email', 'martin@club.com');
    set(root, '#phone', '+54 9 11 5555-1234');
    set(root, '#password', 'unaClave123');
    set(root, '#confirm', 'unaClave123');
    set(root, '#nombreClub', 'Club Solaris');
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();

    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Crear cuenta');
    await h.fixture.whenStable();
    h.fixture.detectChanges();

    expect(recibido).toEqual({
      role: 'club', nombre: 'Martín', apellido: 'Rivas',
      email: 'martin@club.com', password: 'unaClave123',
      phone: '+54 9 11 5555-1234', nombreClub: 'Club Solaris', acceptedTerms: true,
    });
    expect(TestBed.inject(Router).url).toContain('/revisa-tu-mail');
  });

  it('un 409 (email ya registrado) muestra el mensaje de dominio, no el kind crudo', async () => {
    // Regresión: la plantilla mostraba "No pudimos crear la cuenta (domain). Reintentá."
    // en vez de pasar por domainErrorMessage() como el resto de las pantallas de auth.
    const h = await harness('/onboarding', async () => {
      throw { kind: 'domain' as const, message: 'Ese email ya está registrado.' };
    });
    const root: HTMLElement = h.fixture.nativeElement;

    root.querySelector<HTMLInputElement>('input[value="profesor"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();

    set(root, '#nombre', 'Martín');
    set(root, '#apellido', 'Rivas');
    set(root, '#email', 'martin@club.com');
    set(root, '#phone', '+54 9 11 5555-1234');
    set(root, '#password', 'unaClave123');
    set(root, '#confirm', 'unaClave123');
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();

    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Crear cuenta');
    await h.fixture.whenStable();
    h.fixture.detectChanges();

    const errorText = root.querySelector('.foot-error')?.textContent ?? '';
    expect(errorText).toContain('Ese email ya está registrado.');
    expect(errorText).not.toContain('domain');
  });

  it('sesión restaurada en confirm sin password: submit revalida cuenta y no crea el alta', async () => {
    // hydrate() nunca repuebla password/confirm (no se persisten). Si el usuario recarga
    // ya en 'confirm', tilda términos y envía, onSubmit no debe fiarse de que 'account'
    // siga siendo válido: tiene que revalidar todos los pasos, no sólo acceptedTerms.
    const snapshot: OnboardingSnapshot = {
      role: 'club',
      account: { nombre: 'Martín', apellido: 'Rivas', email: 'martin@club.com', phone: '1155551234', nombreClub: 'Club Solaris' },
      acceptedTerms: false,
      step: 'confirm',
    };
    sessionStorage.setItem('setpoint:onboarding:v2', JSON.stringify(snapshot));

    const h = await harness();
    const root: HTMLElement = h.fixture.nativeElement;
    expect(root.querySelector('app-confirm-step')).toBeTruthy(); // restauró en confirm

    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    h.fixture.detectChanges();
    clickText(root, 'Crear cuenta');
    await h.fixture.whenStable();
    h.fixture.detectChanges();

    expect(recibido).toBeNull(); // nunca llegó a facade.signup()
    expect(root.querySelector('app-account-step')).toBeTruthy(); // volvió a 'account'
  });

  it('deep-link ?rol=club: si nombreClub queda vacío, Continuar NO avanza y lo marca inválido', async () => {
    // Pin de la regresión: hydrate() corre antes de que exista la suscripción a
    // role.valueChanges, así que el setValue('club') del deep-link no dispara el toggle
    // del validador condicional si no se sincroniza explícitamente.
    const h = await harness('/onboarding?rol=club');
    const root: HTMLElement = h.fixture.nativeElement;
    expect(root.querySelector('app-account-step')).toBeTruthy();
    expect(root.querySelector('#nombreClub')).toBeTruthy();

    set(root, '#nombre', 'Martín');
    set(root, '#apellido', 'Rivas');
    set(root, '#email', 'martin@club.com');
    set(root, '#password', 'unaClave123');
    set(root, '#confirm', 'unaClave123');
    // nombreClub queda vacío a propósito.
    h.fixture.detectChanges();
    clickText(root, 'Continuar');
    h.fixture.detectChanges();

    expect(root.querySelector('app-confirm-step')).toBeNull(); // no avanzó
    expect(root.querySelector('app-account-step')).toBeTruthy(); // sigue en 'account'
    const nombreClubInput = root.querySelector<HTMLInputElement>('#nombreClub')!;
    expect(nombreClubInput.getAttribute('aria-invalid')).toBe('true');
  });
});
