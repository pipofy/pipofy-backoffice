import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PasswordFacade } from './password.facade';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { SessionStore } from '@domain/contracts/session-store';
import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';

function setup(repo: Partial<AuthRepository>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PasswordFacade,
      { provide: SessionStore, useClass: LocalStorageSessionStore },
      { provide: AuthRepository, useValue: repo },
    ],
  });
  return { facade: TestBed.inject(PasswordFacade), store: TestBed.inject(SessionStore) };
}

describe('PasswordFacade.change', () => {
  beforeEach(() => localStorage.clear());

  it('en el camino feliz marca done() y baja mustChangePassword del store', async () => {
    let enviado: readonly string[] = [];
    const { facade, store } = setup({
      changePassword: async (actual: string, nueva: string) => { enviado = [actual, nueva]; },
    });
    store.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });

    await facade.change('vieja123', 'nuevaClave123');

    expect(enviado).toEqual(['vieja123', 'nuevaClave123']);
    expect(facade.done()).toBe(true);
    expect(store.mustChangePassword()).toBe(false);
  });

  // Sin esto, escribir mal la contraseña actual dejaba pasar igual al dashboard.
  it('si la API rechaza, NO baja la bandera y deja el error', async () => {
    const { facade, store } = setup({
      changePassword: () =>
        Promise.reject({ kind: 'domain' as const, message: 'La contraseña actual es incorrecta.' }),
    });
    store.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });

    await facade.change('mal', 'nuevaClave123');

    expect(facade.done()).toBe(false);
    expect(store.mustChangePassword()).toBe(true);
    expect(facade.error()).toEqual({
      kind: 'domain',
      message: 'La contraseña actual es incorrecta.',
    });
  });
});

describe('PasswordFacade.requestReset', () => {
  beforeEach(() => localStorage.clear());

  it('marca done() al pedir el link', async () => {
    let pedido = '';
    const { facade } = setup({ requestPasswordReset: async (email: string) => { pedido = email; } });
    await facade.requestReset('martin@club.com');
    expect(pedido).toBe('martin@club.com');
    expect(facade.done()).toBe(true);
  });

  it('un fallo de red deja el error y NO marca done()', async () => {
    const { facade } = setup({ requestPasswordReset: () => Promise.reject({ kind: 'network' as const }) });
    await facade.requestReset('martin@club.com');
    expect(facade.done()).toBe(false);
    expect(facade.error()).toEqual({ kind: 'network' });
  });
});

describe('PasswordFacade.confirmReset', () => {
  beforeEach(() => localStorage.clear());

  it('marca done() con token y clave nueva', async () => {
    let enviado: readonly string[] = [];
    const { facade } = setup({
      confirmPasswordReset: async (token: string, nueva: string) => { enviado = [token, nueva]; },
    });
    await facade.confirmReset('tok', 'nuevaClave123');
    expect(enviado).toEqual(['tok', 'nuevaClave123']);
    expect(facade.done()).toBe(true);
  });

  // confirmPasswordReset revoca TODOS los refresh tokens del usuario (auth.service.ts:269):
  // dejar la sesión vieja en el store la convierte en tokens muertos que sólo dan 401.
  it('al confirmar limpia la sesión local, que la API acaba de revocar', async () => {
    const { facade, store } = setup({ confirmPasswordReset: async () => undefined });
    store.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: false });

    await facade.confirmReset('tok', 'nuevaClave123');

    expect(store.isAuthenticated()).toBe(false);
  });

  it('un token vencido deja el error y NO marca done()', async () => {
    const { facade } = setup({
      confirmPasswordReset: () =>
        Promise.reject({ kind: 'domain' as const, message: 'El link venció o ya fue usado.' }),
    });
    await facade.confirmReset('tok', 'nuevaClave123');
    expect(facade.done()).toBe(false);
    expect(facade.error()).toEqual({ kind: 'domain', message: 'El link venció o ya fue usado.' });
  });
});
