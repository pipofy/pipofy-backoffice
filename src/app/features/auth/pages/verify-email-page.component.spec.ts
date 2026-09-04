import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { set } from './form-spec-helpers';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { VerifyEmailPageComponent } from './verify-email-page.component';

function clickText(root: HTMLElement, text: string): void {
  const btn = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  btn!.click();
}

async function setup(url: string, repo: Partial<AuthRepository>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'verificar-email', component: VerifyEmailPageComponent }]),
      { provide: AuthRepository, useValue: repo },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const fixture = harness.fixture;
  fixture.detectChanges();
  return { root: fixture.nativeElement as HTMLElement, fixture };
}

describe('VerifyEmailPageComponent', () => {
  // Pin de la migración de Task 15: el @if que envolvía este <p role="status"> pasó a
  // <app-placeholder tone="loading">, que arma su propio role="status". Sin este test el
  // wiring compila y lintea igual aunque el título quede vacío o el tone esté mal.
  it('con token y verify() pendiente, muestra el estado de carga', async () => {
    const { root } = await setup('/verificar-email?token=tok-123', {
      verifyEmail: () => new Promise<never>(() => undefined),
    });

    expect(root.textContent).toContain('Verificando tu email…');
  });

  it('verify() rechaza: muestra el mensaje de dominio', async () => {
    const { root, fixture } = await setup('/verificar-email?token=tok-vencido', {
      verifyEmail: () =>
        Promise.reject({ kind: 'domain' as const, message: 'El link venció o ya fue usado.' }),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('El link venció o ya fue usado.');
  });

  // Cubre el @if que se colapsó dentro de [show] de app-field-error en verify-email-page.
  // Sin este test un [show]="otraCosa" del mismo tipo boolean compila y lintea perfecto y
  // nunca se detecta que el error de campo dejó de aparecer.
  it('campo email inválido y tocado: muestra el error de campo', async () => {
    const { root, fixture } = await setup('/verificar-email', {});
    set(root, '#email', 'no-es-un-email');
    root.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(root.textContent).toContain('Ingresá un email válido.');
  });

  // Contrapartida del test anterior: sin esta, un assert de "se muestra" sin su par de "no
  // se muestra" es vacuo (podría estar siempre visible y el test de arriba igual pasaría).
  it('campo email sin tocar: no muestra el error de campo', async () => {
    const { root } = await setup('/verificar-email', {});

    expect(root.textContent).not.toContain('Ingresá un email válido.');
  });

  it('resending() en true: muestra el estado de carga del reenvío', async () => {
    const { root, fixture } = await setup('/verificar-email', {
      resendVerification: () => new Promise<never>(() => undefined),
    });
    set(root, '#email', 'martin@clubsolaris.com');
    fixture.detectChanges();
    clickText(root, 'Reenviar el link');
    fixture.detectChanges();

    expect(root.textContent).toContain('Reenviando el link…');
  });
});
