import { signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EnConstruccionComponent } from '@shared/ui/en-construccion.component';
import { SessionFacade } from '@features/auth/session.facade';
import { SessionStore } from '@data/auth/session-store';
import { UsersRepository } from '@data/repositories/users.repository';
import { CurrentUserDto } from '@data/dto/users.dto';
import { ShellComponent } from './shell.component';
import { NAV_ITEMS } from './nav.model';

// SessionStore vive en root (app.config.ts) y el TestBed no lo trae: el shell lo inyecta
// para leer el rol del token, así que va un doble con los dos signals que consume.
// Parametrizable por `roles` para cubrir las dos ramas del fallback de rol() (ver el describe
// de "pie del sidebar" más abajo): lista vacía y un rol fuera de ROLE_LABELS.
function sessionStore(roles: readonly string[] = ['admin']) {
  return { roles: signal(roles), clubId: signal<string | null>('42') };
}

const SESSION_STORE_STUB = sessionStore();

/**
 * Doble de UsersRepository (root, igual que SessionStore). `null` simula que /users/me
 * falló: el shell tiene que seguir renderizando con el rol solo.
 */
function usersRepo(user: Partial<CurrentUserDto> | null = { nombre: 'Ana', apellido: 'Pérez' }) {
  return {
    me: async () => {
      if (user === null) throw { kind: 'network' };
      return { id: '9', clubId: '42', email: null, nombre: null, apellido: null, roles: [], ...user };
    },
  } as UsersRepository;
}

const routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: 'dashboard', component: EnConstruccionComponent, data: { title: 'Operaciones en tiempo real', crumb: 'Operación' } },
      { path: 'grupos', component: EnConstruccionComponent, data: { title: 'Grupos y clases', crumb: 'Grupos' } },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' as const },
    ],
  },
];

async function setup(url: string, store = SESSION_STORE_STUB, users = usersRepo()) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes),
      { provide: SessionFacade, useValue: { logout: async () => undefined } },
      { provide: SessionStore, useValue: store },
      { provide: UsersRepository, useValue: users },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  // El shell pide /users/me en su constructor. Sin drenar la microtask cola, el nombre
  // todavía no llegó y CUALQUIER aserción sobre el pie mediría el estado de carga.
  await Promise.resolve();
  await Promise.resolve();
  harness.detectChanges();
  return harness;
}

describe('ShellComponent', () => {
  it('renderiza los 7 destinos de la nav', async () => {
    const harness = await setup('/dashboard');
    const labels = Array.from(harness.fixture.nativeElement.querySelectorAll('.nav a'))
      .map((a) => (a as HTMLElement).textContent?.trim() ?? '');
    for (const item of NAV_ITEMS) {
      expect(labels.some((l) => l.includes(item.label))).toBe(true);
    }
  });

  it('marca el destino activo según la URL', async () => {
    const harness = await setup('/grupos');
    const active = harness.fixture.nativeElement.querySelector('.nav a.on');
    expect(active?.textContent).toContain('Grupos');
  });

  it('refleja title y crumb del data de la ruta activa', async () => {
    const harness = await setup('/dashboard');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('.topbar h1')?.textContent).toContain('Operaciones en tiempo real');
    expect(root.querySelector('.topbar .crumb')?.textContent).toContain('Operación');
  });

  it('el toggle del drawer abre y cierra la sidebar', async () => {
    const harness = await setup('/dashboard');
    const root: HTMLElement = harness.fixture.nativeElement;
    const hamb = root.querySelector<HTMLButtonElement>('.hamb')!;
    const side = root.querySelector('.side')!;

    expect(side.classList.contains('open')).toBe(false);
    hamb.click();
    await harness.fixture.whenStable();
    expect(side.classList.contains('open')).toBe(true);
    expect(hamb.getAttribute('aria-expanded')).toBe('true');

    hamb.click();
    await harness.fixture.whenStable();
    expect(side.classList.contains('open')).toBe(false);
    expect(hamb.getAttribute('aria-expanded')).toBe('false');
  });

  it('el botón de cerrar sesión llama a logout() y redirige a /login', async () => {
    let llamado = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'login', component: EnConstruccionComponent }]),
        { provide: SessionFacade, useValue: { logout: async () => { llamado = true; } } },
        { provide: SessionStore, useValue: SESSION_STORE_STUB },
        { provide: UsersRepository, useValue: usersRepo() },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const btn = [...root.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Cerrar sesión'));
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();
    expect(llamado).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('si logout() rechaza, igual redirige a /login', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'login', component: EnConstruccionComponent }]),
        { provide: SessionFacade, useValue: { logout: () => Promise.reject(new Error('boom')) } },
        { provide: SessionStore, useValue: SESSION_STORE_STUB },
        { provide: UsersRepository, useValue: usersRepo() },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const btn = [...root.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Cerrar sesión'));
    btn!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});

describe('ShellComponent · pie del sidebar y decoración muerta', () => {
  it('muestra el rol real del token, no un nombre inventado', async () => {
    const harness = await setup('/dashboard');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('.side-foot .u-role')?.textContent).toContain('Administrador');
    expect(root.textContent).not.toContain('Martín Rivas');
  });

  it('sin roles en el token muestra "Sin rol"', async () => {
    const harness = await setup('/dashboard', sessionStore([]));
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('.side-foot .u-role')?.textContent).toContain('Sin rol');
  });

  it('un rol fuera de ROLE_LABELS se muestra crudo, no oculto', async () => {
    // Si alguien renombra una clave de ROLE_LABELS, el sidebar tiene que seguir mostrando ALGO
    // (el rol crudo) en vez de fallar en silencio o mostrar un rótulo viejo.
    const harness = await setup('/dashboard', sessionStore(['coordinador']));
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('.side-foot .u-role')?.textContent).toContain('coordinador');
  });

  it('no renderiza el selector de tenant ni el buscador global: ninguno tenía handler', async () => {
    const harness = await setup('/dashboard');
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('.tenant')).toBeNull();
    expect(root.querySelector('#global-q')).toBeNull();
    // Amplia a todo el shell a propósito: app-site-footer (que se renderiza en cada pantalla)
    // también decía "Club Solaris" hardcodeado — se corrigió en site-footer.component.ts — así
    // que esta aserción protege contra que el nombre inventado vuelva a aparecer en cualquier lado.
    expect(root.textContent).not.toContain('Club Solaris');
  });

  it('muestra el nombre real del usuario logueado, arriba del rol', async () => {
    const harness = await setup('/dashboard');
    const foot: HTMLElement = harness.fixture.nativeElement.querySelector('.side-foot');
    expect(foot.querySelector('.u-name')?.textContent).toContain('Ana Pérez');
    expect(foot.querySelector('.u-role')?.textContent).toContain('Administrador');
  });

  it('si /users/me falla, el pie queda como antes: rol sí, renglón de nombre no', async () => {
    // El nombre es decoración: un error acá no puede romper el shell de alguien que ya entró.
    const harness = await setup('/dashboard', SESSION_STORE_STUB, usersRepo(null));
    const foot: HTMLElement = harness.fixture.nativeElement.querySelector('.side-foot');
    expect(foot.querySelector('.u-name')).toBeNull();
    expect(foot.querySelector('.u-role')?.textContent).toContain('Administrador');
  });

  it('un usuario sin nombre cargado muestra su email', async () => {
    const harness = await setup('/dashboard', SESSION_STORE_STUB, usersRepo({ email: 'ana@club.com' }));
    const foot: HTMLElement = harness.fixture.nativeElement.querySelector('.side-foot');
    expect(foot.querySelector('.u-name')?.textContent).toContain('ana@club.com');
  });

  it('no dibuja el badge cuando el contador está en cero', async () => {
    // NavBadgesService lo provee el propio ShellComponent, así que acá corre el real.
    const harness = await setup('/dashboard');
    expect(harness.fixture.nativeElement.querySelector('.badge')).toBeNull();
  });
});
