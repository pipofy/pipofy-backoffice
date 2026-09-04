import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SessionFacade } from './session.facade';
import { SessionStore } from '@data/auth/session-store';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { TenantContext } from '@shared/tenant/tenant-context';

/** JWT armado a mano con clubId en el payload. */
const jwtConClub = `h.${btoa(JSON.stringify({ sub: '1', clubId: '42' }))}.s`;

function setup(repo: Partial<AuthRepository>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      SessionFacade,
      SessionStore,
      { provide: AuthRepository, useValue: repo },
    ],
  });
  return {
    facade: TestBed.inject(SessionFacade),
    store: TestBed.inject(SessionStore),
    tenant: TestBed.inject(TenantContext),
  };
}

describe('SessionFacade', () => {
  beforeEach(() => localStorage.clear());

  it('login() guarda la sesión y publica el clubId en TenantContext', async () => {
    const { facade, store, tenant } = setup({
      login: async () => ({ accessToken: jwtConClub, refreshToken: 'r', mustChangePassword: false }),
    });
    await facade.login('a@b.com', 'x');
    expect(store.isAuthenticated()).toBe(true);
    expect(tenant.tenantId()).toBe('42');
    expect(facade.error()).toBeNull();
  });

  it('un login fallido deja el error y NO guarda sesión', async () => {
    const { facade, store } = setup({
      login: () => Promise.reject({ kind: 'invalid-credentials' as const }),
    });
    await facade.login('a@b.com', 'mal');          // run() atrapa: no rechaza
    expect(facade.error()).toEqual({ kind: 'invalid-credentials' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('logout() avisa a la API, limpia la sesión y el tenant', async () => {
    let avisado: string | null = null;
    const { facade, store, tenant } = setup({
      login: async () => ({ accessToken: jwtConClub, refreshToken: 'r', mustChangePassword: false }),
      logout: async (rt: string) => { avisado = rt; },
    });
    await facade.login('a@b.com', 'x');
    await facade.logout();
    expect(avisado).toBe('r');
    expect(store.isAuthenticated()).toBe(false);
    expect(tenant.tenantId()).toBeNull();
  });

  it('si la API falla en el logout, la sesión local se limpia igual', async () => {
    const { facade, store } = setup({
      login: async () => ({ accessToken: jwtConClub, refreshToken: 'r', mustChangePassword: false }),
      logout: () => Promise.reject({ kind: 'network' as const }),
    });
    await facade.login('a@b.com', 'x');
    await facade.logout();
    // Dejar al usuario "adentro" porque el server no contestó sería peor que un token huérfano.
    expect(store.isAuthenticated()).toBe(false);
  });

  it('un segundo login que falla tras un logout forzado NO reinstala la sesión revocada', async () => {
    // Repro del bug: SessionFacade es root-scoped (vive toda la carga de página), así que su
    // data() de SignalStore sobrevive entre intentos de login. Si un login fallido leyera ese
    // data() (dejado por un login anterior exitoso) en vez de ignorarlo, reinstalaría una
    // sesión ya revocada (ej. por un 401 de refresh que hizo store.clear()) y reescribiría
    // localStorage con tokens muertos.
    let fail = false;
    const { facade, store } = setup({
      login: async () => {
        if (fail) throw { kind: 'invalid-credentials' as const };
        return { accessToken: jwtConClub, refreshToken: 'r', mustChangePassword: false };
      },
    });

    await facade.login('a@b.com', 'x');
    expect(store.isAuthenticated()).toBe(true);

    // Simula lo que hace TokenRefresher cuando un refresh de tokens falla: limpia la sesión.
    store.clear();
    expect(store.isAuthenticated()).toBe(false);

    fail = true;
    await facade.login('a@b.com', 'mal');

    expect(facade.error()).toEqual({ kind: 'invalid-credentials' });
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('PipoFy:session:v1')).toBeNull();
  });
});
