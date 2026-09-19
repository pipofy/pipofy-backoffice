import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { authGuard } from './auth.guard';
import { SessionStore } from '@domain/contracts/session-store';
import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';

@Component({ standalone: true, template: 'privado' })
class PrivadoComponent {}

@Component({ standalone: true, template: 'login' })
class LoginStubComponent {}

@Component({ standalone: true, template: 'cambiar-clave' })
class CambiarClaveStubComponent {}

async function harness(conSesion: boolean, mustChangePassword = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: SessionStore, useClass: LocalStorageSessionStore },
      provideRouter([
        { path: 'login', component: LoginStubComponent },
        { path: 'cambiar-clave', component: CambiarClaveStubComponent },
        { path: 'dashboard', component: PrivadoComponent, canActivate: [authGuard] },
      ]),
    ],
  });
  if (conSesion) {
    TestBed.inject(SessionStore).set({ accessToken: 'a', refreshToken: 'r', mustChangePassword });
  }
  return RouterTestingHarness.create();
}

describe('authGuard', () => {
  beforeEach(() => localStorage.clear());

  it('con sesión deja pasar', async () => {
    const h = await harness(true);
    await h.navigateByUrl('/dashboard');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('sin sesión redirige a /login conservando returnUrl', async () => {
    const h = await harness(false);
    await h.navigateByUrl('/dashboard');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fdashboard');
  });

  // El redirect vive en el guard y no en el submit del login a propósito: así también cubre
  // el F5 y el deep-link, que no pasan por la pantalla de login.
  it('con sesión pero mustChangePassword manda a /cambiar-clave', async () => {
    const h = await harness(true, true);
    await h.navigateByUrl('/dashboard');
    expect(TestBed.inject(Router).url).toBe('/cambiar-clave');
  });

  it('devuelve un UrlTree, no un booleano, cuando bloquea', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SessionStore, useClass: LocalStorageSessionStore },
        provideRouter([]),
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/grupos/3' } as never),
    );
    expect(result).toBeInstanceOf(UrlTree);
  });
});
