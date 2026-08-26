import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ClubRepository } from '@domain/contracts/club.repository';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { ApiClient } from '@data/http/api-client';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { UsersRepository } from '@data/repositories/users.repository';
import { SessionStore } from '@data/auth/session-store';
import { API_CONFIG } from '@data/config/api-config.token';
import { SessionFacade } from '@features/auth/session.facade';
import { routes } from './app.routes';

// La ruta /dashboard bindea HttpDashboardRepository, que compone el snapshot desde ApiClient
// (courts, coaches, category-groups, catálogos y class-sessions). Se stubea ApiClient acá —
// no lo re-provee DASHBOARD_PROVIDERS — así los cinco repos HTTP de la feature resuelven sin
// tocar HttpClient ni la red: este test es de ruteo, no de datos. HttpClient/API_CONFIG se
// stubean también porque HttpCategoryGroupsRepository los inyecta en el field initializer
// (para addItem/removeItem, Task 1) aunque esta ruta sólo llame a list().
//
// Este TestBed arma sus providers a mano a partir de `routes`, no de `appConfig` (que ya
// bindea AuthRepository en root desde Task 7): sin este stub, /onboarding tira NG0201 acá
// igual que en runtime real. SessionStore/SessionFacade se suman por lo mismo desde Task 9:
// las rutas del shell quedan detrás de authGuard y, sin sesión, una navegación cae en /login,
// que necesita SessionFacade (bindeada en root en app.config.ts).
async function harnessAt(url: string, conSesion = true, mustChangePassword = false) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes),
      SessionStore,
      SessionFacade,
      { provide: ClubRepository, useValue: { isActive: async () => true } },
      { provide: AuthRepository, useValue: { signup: async () => undefined } },
      { provide: ApiClient, useValue: { get: () => of([]) } },
      { provide: HttpClient, useValue: {} as HttpClient },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
      // En root, igual que en app.config.ts: lo usan Configuración y el dashboard, y una
      // instancia por ruta lazy significaba un cache de catálogos por ruta.
      CatalogsRepository,
      // Igual que CatalogsRepository: en root porque su consumidor es ShellComponent, que no
      // cuelga de ninguna ruta lazy. Corre el real contra el ApiClient stubeado — devuelve
      // `[]`, el parse falla y el shell se lo come en silencio, que es justo su contrato.
      UsersRepository,
    ],
  });
  if (conSesion) {
    // Las rutas del shell están detrás de authGuard: sin sesión, todas redirigen a /login.
    TestBed.inject(SessionStore).set({
      accessToken: 'test',
      refreshToken: 'test',
      mustChangePassword,
    });
  }
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return harness;
}

describe('app.routes', () => {
  // SessionStore persiste en localStorage real (jsdom): sin este clear, una sesión sembrada
  // por un test anterior sobrevive a hydrate() y el test "sin sesión" queda autenticado.
  beforeEach(() => localStorage.clear());

  it('la raíz redirige a /dashboard dentro del shell', async () => {
    const harness = await harnessAt('/');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeTruthy();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('/dashboard renderiza el dashboard operativo dentro del shell', async () => {
    const harness = await harnessAt('/dashboard');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeTruthy();
    expect(root.querySelector('app-dashboard-page')).toBeTruthy();
  });

  it('una ruta no construida muestra el placeholder dentro del shell', async () => {
    // /grupos ya está construida (slice 2). /comercial sigue siendo enConstruccion (app.routes.ts:23).
    const harness = await harnessAt('/comercial');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeTruthy();
    expect(root.querySelector('app-en-construccion')?.textContent).toContain('construcción');
  });

  it('/grupos renderiza la lista de grupos dentro del shell', async () => {
    const harness = await harnessAt('/grupos');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeTruthy();
    expect(root.querySelector('app-grupos-list-page')).toBeTruthy();
  });

  it('/onboarding NO tiene shell (ruta pública)', async () => {
    const harness = await harnessAt('/onboarding');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeNull();
    expect(root.querySelector('app-onboarding-wizard')).toBeTruthy();
  });

  it('/onboarding renderiza el wizard público, fuera del shell', async () => {
    const harness = await harnessAt('/onboarding');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-onboarding-wizard')).not.toBeNull();
    expect(root.querySelector('.side')).toBeNull(); // no hay sidebar del shell
  });

  it('sin sesión, una ruta protegida del shell redirige a /login', async () => {
    await harnessAt('/dashboard', false);
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fdashboard');
  });

  // La ruta la fija el mail que manda la API (auth.service.ts:239): si deja de existir o
  // pide sesión, el link del reset lleva a un 404 o a /login.
  it('/reset-password es pública y va fuera del shell', async () => {
    const harness = await harnessAt('/reset-password', false);
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('app-shell')).toBeNull();
    expect(root.querySelector('app-reset-password-page')).toBeTruthy();
    expect(TestBed.inject(Router).url).toBe('/reset-password');
  });

  it('con mustChangePassword, una ruta del shell desemboca en /cambiar-clave y ahí se queda', async () => {
    const harness = await harnessAt('/dashboard', true, true);
    const root: HTMLElement = harness.fixture.nativeElement;
    // Que se quede es el punto: /cambiar-clave cuelga fuera del shell justamente para no
    // volver a pasar por authGuard y rebotar para siempre.
    expect(TestBed.inject(Router).url).toBe('/cambiar-clave');
    expect(root.querySelector('app-change-password-page')).toBeTruthy();
    expect(root.querySelector('app-shell')).toBeNull();
  });
});
