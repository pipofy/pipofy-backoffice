import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { submitForm } from './form-spec-helpers';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { SessionStore } from '@domain/contracts/session-store';
import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';
import { ChangePasswordPageComponent } from './change-password-page.component';

@Component({ standalone: true, template: 'dashboard' })
class DashboardStubComponent {}

async function mount(repo: Partial<AuthRepository>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([
        { path: 'cambiar-clave', component: ChangePasswordPageComponent },
        { path: 'dashboard', component: DashboardStubComponent },
      ]),
      { provide: SessionStore, useClass: LocalStorageSessionStore },
      { provide: AuthRepository, useValue: repo },
    ],
  });
  TestBed.inject(SessionStore).set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/cambiar-clave');
  return harness;
}

describe('ChangePasswordPageComponent', () => {
  beforeEach(() => localStorage.clear());

  it('en el camino feliz cambia la clave y va al dashboard', async () => {
    let enviado: readonly string[] = [];
    const harness = await mount({
      changePassword: async (actual: string, nueva: string) => { enviado = [actual, nueva]; },
    });

    await submitForm(harness, {
      '#current': 'vieja123',
      '#nueva': 'nuevaClave123',
      '#repetir': 'nuevaClave123',
    });

    expect(enviado).toEqual(['vieja123', 'nuevaClave123']);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(TestBed.inject(SessionStore).mustChangePassword()).toBe(false);
  });

  // Si las dos no coinciden, el usuario se queda afuera de su propia cuenta con una clave
  // que escribió mal: el chequeo tiene que cortar ANTES de llamar a la API.
  it('con las claves nuevas distintas no llama a la API y muestra el error', async () => {
    let llamado = false;
    const harness = await mount({ changePassword: async () => { llamado = true; } });

    const root = await submitForm(harness, {
      '#current': 'vieja123',
      '#nueva': 'nuevaClave123',
      '#repetir': 'otraCosa456',
    });

    expect(llamado).toBe(false);
    expect(root.textContent).toContain('no coinciden');
    expect(TestBed.inject(Router).url).toBe('/cambiar-clave');
  });

  it('una clave nueva de menos de 8 no llama a la API', async () => {
    let llamado = false;
    const harness = await mount({ changePassword: async () => { llamado = true; } });

    await submitForm(harness, { '#current': 'vieja123', '#nueva': 'corta', '#repetir': 'corta' });

    expect(llamado).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/cambiar-clave');
  });

  it('si la API rechaza, muestra el mensaje y NO navega', async () => {
    const harness = await mount({
      changePassword: () =>
        Promise.reject({ kind: 'domain' as const, message: 'La contraseña actual es incorrecta.' }),
    });

    const root = await submitForm(harness, {
      '#current': 'mal',
      '#nueva': 'nuevaClave123',
      '#repetir': 'nuevaClave123',
    });

    expect(root.textContent).toContain('La contraseña actual es incorrecta.');
    expect(TestBed.inject(Router).url).toBe('/cambiar-clave');
  });
});
