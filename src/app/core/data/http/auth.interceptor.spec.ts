import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { TokenRefresher } from './token-refresher';
import { SessionStore } from '@domain/contracts/session-store';
import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';
import { HttpAuthRepository } from '../repositories/http-auth.repository';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { API_CONFIG } from '@config/api-config';

// El repo devuelve Promise (patrón del proyecto), así que `from(promise)` en TokenRefresher
// resuelve en un microtask: entre el flush del refresh y la salida del reintento hay que
// ceder el turno. Sin esto el test falla con "found none", que parece un bug del
// interceptor y NO lo es.
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: SessionStore, useClass: LocalStorageSessionStore },
      TokenRefresher,
      { provide: AuthRepository, useClass: HttpAuthRepository },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '/api/stream' } },
    ],
  });
  const store = TestBed.inject(SessionStore);
  store.set({ accessToken: 'OLD', refreshToken: 'R1', mustChangePassword: false });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController), store };
}

describe('authInterceptor', () => {
  beforeEach(() => localStorage.clear());

  it('agrega Authorization: Bearer a los requests de negocio', async () => {
    const { http, ctrl } = setup();
    const done = firstValueFrom(http.get('/api/students'));
    const req = ctrl.expectOne('/api/students');
    expect(req.request.headers.get('Authorization')).toBe('Bearer OLD');
    req.flush({ ok: true });
    await done;
    ctrl.verify();
  });

  it('los requests a /auth/ salen SIN Authorization', async () => {
    const { http, ctrl } = setup();
    const done = firstValueFrom(http.post('/api/auth/login', {}));
    const req = ctrl.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: 'a', refreshToken: 'r' });
    await done;
    ctrl.verify();
  });

  it('/auth/change-password SÍ lleva Bearer: es el único /auth/ autenticado', async () => {
    const { http, ctrl } = setup();
    const done = firstValueFrom(http.post('/api/auth/change-password', {}));
    const req = ctrl.expectOne('/api/auth/change-password');
    expect(req.request.headers.get('Authorization')).toBe('Bearer OLD');
    req.flush(null);
    await done;
    ctrl.verify();
  });

  it('un 401 de /auth/change-password NO dispara refresh: es "clave actual incorrecta"', async () => {
    const { http, ctrl } = setup();
    const done = firstValueFrom(http.post('/api/auth/change-password', {}));

    ctrl.expectOne('/api/auth/change-password')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toBeDefined();
    ctrl.verify();               // no hubo request a /auth/refresh ni reintento
  });

  it('/auth/password-reset/confirm sale SIN Authorization: es público', async () => {
    const { http, ctrl } = setup();
    const done = firstValueFrom(http.post('/api/auth/password-reset/confirm', {}));
    const req = ctrl.expectOne('/api/auth/password-reset/confirm');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null);
    await done;
    ctrl.verify();
  });

  it('ante un 401 refresca y reintenta con el token nuevo', async () => {
    const { http, ctrl, store } = setup();
    const done = firstValueFrom(http.get<{ ok: boolean }>('/api/students'));

    ctrl.expectOne('/api/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/auth/refresh').flush({ accessToken: 'NEW', refreshToken: 'R2' });
    await tick();

    const retry = ctrl.expectOne('/api/students');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer NEW');
    retry.flush({ ok: true });

    expect(await done).toEqual({ ok: true });
    expect(store.accessToken()).toBe('NEW');
    ctrl.verify();
  });

  it('un segundo 401, tras un primer refresh ya resuelto, dispara un segundo refresh', async () => {
    // Lo que este test fija: finalize() limpia this.inFlight cuando el primer refresh termina,
    // así el segundo 401 (típico: sesiones de 30 días, refresh cada 2hs) dispara un refresh
    // FRESCO con el refreshToken rotado (R2), en vez de colgarse del shareReplay(1) ya completo
    // del primer refresh y reintentar con un token viejo.
    // Esto NO fija el orden finalize()/shareReplay(1) en sí: da igual invertirlos, los 7 tests
    // de este archivo pasan igual. Ese orden solo importa ante un unsubscribe temprano o
    // subscripciones solapadas — ningún test de este archivo ejercita eso.
    const { http, ctrl, store } = setup();

    const done1 = firstValueFrom(http.get<{ ok: boolean }>('/api/students'));
    ctrl.expectOne('/api/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/auth/refresh').flush({ accessToken: 'NEW1', refreshToken: 'R2' });
    await tick();
    ctrl.expectOne('/api/students').flush({ ok: true });
    expect(await done1).toEqual({ ok: true });
    expect(store.accessToken()).toBe('NEW1');

    const done2 = firstValueFrom(http.get<{ ok: boolean }>('/api/courts'));
    ctrl.expectOne('/api/courts').flush(null, { status: 401, statusText: 'Unauthorized' });

    // El punto del test: esto tiene que salir un SEGUNDO request de refresh, cargando el
    // token que dejó el primero (R2), no reusar el primer refresh ya completado.
    const secondRefresh = ctrl.expectOne('/api/auth/refresh');
    expect(secondRefresh.request.body).toEqual({ refreshToken: 'R2' });
    secondRefresh.flush({ accessToken: 'NEW2', refreshToken: 'R3' });
    await tick();

    const retry = ctrl.expectOne('/api/courts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer NEW2');
    retry.flush({ ok: true });

    expect(await done2).toEqual({ ok: true });
    expect(store.accessToken()).toBe('NEW2');
    ctrl.verify();
  });

  it('tres 401 concurrentes disparan UN SOLO refresh', async () => {
    const { http, ctrl } = setup();
    const urls = ['/api/students', '/api/courts', '/api/plans'];
    const done = Promise.all(urls.map((u) => firstValueFrom(http.get<{ u: string }>(u))));

    for (const u of urls) ctrl.expectOne(u).flush(null, { status: 401, statusText: 'Unauthorized' });

    // El punto del test: el refresh de la API es ROTATIVO (revoca el token usado). Tres
    // refreshes en paralelo dejarían dos tokens muertos y patearían al usuario al login.
    const refreshes = ctrl.match('/api/auth/refresh');
    expect(refreshes.length).toBe(1);
    refreshes[0].flush({ accessToken: 'NEW', refreshToken: 'R2' });
    await tick();

    for (const u of urls) {
      const retry = ctrl.expectOne(u);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer NEW');
      retry.flush({ u });
    }

    expect(await done).toEqual(urls.map((u) => ({ u })));
    ctrl.verify();
  });

  it('si el refresh falla, limpia la sesión y propaga sin loop', async () => {
    const { http, ctrl, store } = setup();
    const done = firstValueFrom(http.get('/api/students'));

    ctrl.expectOne('/api/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toBeDefined();
    expect(store.isAuthenticated()).toBe(false);
    ctrl.verify();
  });

  it('sin sesión, el 401 se propaga tal cual y no intenta refrescar', async () => {
    const { http, ctrl, store } = setup();
    store.clear();
    const done = firstValueFrom(http.get('/api/students'));

    const req = ctrl.expectOne('/api/students');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toBeDefined();
    ctrl.verify();               // no hubo request a /auth/refresh
  });
});
