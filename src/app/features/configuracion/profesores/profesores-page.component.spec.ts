import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProfesoresPageComponent } from './profesores-page.component';
import { ProfesoresFacade } from './profesores.facade';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Coach } from '@domain/entities/coach';
import { ToastService } from '@shared/ui/toast/toast.service';
import { UsersRepository } from '@data/repositories/users.repository';

const COACHES: Coach[] = [
  { id: '1', displayName: 'Ana Díaz', description: 'Revés a una mano' },
  { id: '2', displayName: 'Zulema Paz', description: null },
];

const ROLES = [
  { id: '3', name: 'admin' },
  { id: '7', name: 'profesor' },
];

function setup(repo: Partial<CoachesRepository>, users: Partial<UsersRepository> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CoachesRepository, useValue: repo },
      { provide: UsersRepository, useValue: users },
      ProfesoresFacade,
      ToastService,
    ],
  });
  const fixture = TestBed.createComponent(ProfesoresPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ProfesoresPageComponent', () => {
  it('lista los profesores ordenados, con — cuando no hay descripción', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    // f.nativeElement es `any`: Array.from(any) degrada a unknown[] en modo strict (TS2571).
    // Se tipa como HTMLElement antes de querySelectorAll, mismo patrón que
    // planes-page.component.spec.ts y grupos-categoria-page.component.spec.ts.
    const filas = Array.from((f.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Ana Díaz');
    expect(filas[1].textContent).toContain('—');
  });

  it('ofrece alta pero NO baja: no hay endpoint para borrar un profesor', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Nuevo profesor');
    expect(f.nativeElement.querySelector('.btn-danger')).toBeNull();
    expect(f.nativeElement.querySelector('app-confirm-delete-modal')).toBeNull();
  });

  it('avisa que el alta manda un mail con una contraseña temporal', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('contraseña temporal');
  });

  it('el vacío ahora SÍ puede invitar a cargar: el alta existe', async () => {
    const f = setup({ list: async () => [] });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Todavía no hay profesores');
  });

  it('con la carga fallada NO muestra el vacío: data() en null es "no sé", no "está vacío"', async () => {
    // Regla 2 de §8.0.
    const f = setup({
      list: async () => {
        throw { kind: 'network' };
      },
    });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('No hay profesores en este club');
    expect(f.nativeElement.querySelector('.notice')).toBeTruthy();
  });

  it('guardar cierra el modal y avisa', async () => {
    // async () => {} dispara @typescript-eslint/no-empty-function (sin allowlist en este
    // proyecto); una arrow con cuerpo de expresión no cuenta como "vacía" para esa regla.
    const f = setup({ list: async () => COACHES, update: async () => undefined });
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="edit"]') as HTMLButtonElement).click();
    f.detectChanges();
    const area = f.nativeElement.querySelector('#profesor-descripcion') as HTMLTextAreaElement;
    area.value = 'Nueva';
    area.dispatchEvent(new Event('input'));
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('dialog')!.open).toBe(false);
  });

  it('si falla el guardado el modal QUEDA abierto: es donde se corrige', async () => {
    const f = setup({
      list: async () => COACHES,
      update: async () => {
        throw { kind: 'not-found' };
      },
    });
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="edit"]') as HTMLButtonElement).click();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('dialog')!.open).toBe(true);
  });

  it('reconstruir la página con data() poblado y error() de un guardado viejo NO lo reaparece', async () => {
    // Regresión del code review, fix round 1: la facade se provee en la ruta PADRE (sobrevive
    // al cambio de tab). Si save() falla y el usuario navega a otra tab y vuelve, el
    // componente se reconstruye con data() YA poblado — el `if (!data() && ...) load()` del
    // constructor no vuelve a correr, así que sin clearError() el banner de un guardado viejo
    // reaparecería sobre una tabla que está perfectamente bien.
    const f = setup({
      list: async () => COACHES,
      update: async () => {
        throw { kind: 'not-found' };
      },
    });
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="edit"]') as HTMLButtonElement).click();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.notice')).toBeTruthy(); // sanity: el guardado falló

    // "Cambiar de tab y volver": la facade (providers del TestBed, como en la ruta padre real)
    // sobrevive; sólo se recrea el componente.
    const f2 = TestBed.createComponent(ProfesoresPageComponent);
    f2.detectChanges();
    expect(f2.nativeElement.querySelector('.notice')).toBeNull();
  });

  // Hay DOS <dialog> en la página: el de edición va primero en el template, así que
  // querySelector('dialog') a secas sigue devolviendo ése. El de alta se busca por su host.
  const dialogNuevo = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelector('app-profesor-nuevo-modal dialog') as HTMLDialogElement;

  it('el botón de alta abre el modal de alta', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(true);
    expect(f.nativeElement.querySelector('#profesor-email')).not.toBeNull();
  });

  it('el alta exitosa cierra el modal', async () => {
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => ROLES, create: async () => undefined },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    (dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(false);
  });

  it('alta exitosa con relectura fallida: cierra el modal pero NO toastea, el banner ya lo cuenta', async () => {
    // crear() devuelve true apenas la ESCRITURA anduvo; el error de la RELECTURA llega
    // después, en error(). La página no puede toastear éxito si terminó con un banner rojo.
    let llamadas = 0;
    const f = setup(
      {
        list: async () => {
          llamadas++;
          if (llamadas > 1) throw { kind: 'network' };
          return COACHES;
        },
      },
      { roles: async () => ROLES, create: async () => undefined },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    (dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(false);
    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
  });

  it('el alta fallida deja el modal ABIERTO para corregir', async () => {
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => [{ id: '3', name: 'admin' }], create: async () => undefined },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    (dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(true);
    expect(f.nativeElement.textContent).toContain('rol de profesor');
  });

  it('después de un alta fallida se puede reintentar: markFailed() libera el guard', async () => {
    // Sin markFailed(), el signal `saving` del modal queda en true y el botón deshabilitado
    // para siempre: el usuario ve el error y no puede corregirlo.
    let intentos = 0;
    const f = setup(
      { list: async () => COACHES },
      {
        roles: async () => ROLES,
        create: async () => {
          intentos++;
          throw { kind: 'network' };
        },
      },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    const guardar = dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement;
    guardar.click();
    await f.whenStable();
    f.detectChanges();
    guardar.click();
    await f.whenStable();
    expect(intentos).toBe(2);
  });
});
