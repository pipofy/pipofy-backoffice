import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { GruposListPageComponent } from './grupos-list-page.component';
import { GruposFacade } from '../grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Group } from '@domain/entities/group';

const grupo = (over: Partial<Group> = {}): Group => ({
  id: '7', category: '7ma+8va', teacher: 'Diego A.', courtName: 'Cancha 1',
  weekday: 1, startTime: '18:00', capacity: 4, enrolled: 3,
  nextSessionId: '301', sessions: [], ...over,
});

/** Salto de MACROTAREA. whenStable() cede UN tick de microtarea y sólo espera el PendingTasks
 *  de Angular: la cadena load()→run()→setData() no está registrada ahí. Sin esto los asserts
 *  corren antes de que exista la pantalla. Ver dashboard-page.component.spec.ts:31-37. */
const flushRepo = () => new Promise((r) => setTimeout(r, 0));

/** Los tres de abajo sólo existen porque GruposFacade los inyecta; la lista no los usa. */
function providers(repo: GroupsRepository) {
  return [
    provideZonelessChangeDetection(),
    provideRouter([]),
    GruposFacade,
    { provide: GroupsRepository, useValue: repo },
    { provide: ClassSessionsRepository, useValue: {} as unknown as ClassSessionsRepository },
    { provide: CategoriesRepository, useValue: {} as unknown as CategoriesRepository },
    { provide: ReservationsRepository, useValue: {} as unknown as ReservationsRepository },
    { provide: StudentsRepository, useValue: {} as unknown as StudentsRepository },
  ];
}

const repoCon = (groups: Group[]) =>
  ({ listGroups: async () => groups }) as unknown as GroupsRepository;

const DOS = [grupo(), grupo({ id: '8', category: '6ta', teacher: 'Sofía R.', weekday: 3,})];

async function mount(repo: GroupsRepository = repoCon(DOS)) {
  TestBed.configureTestingModule({ providers: providers(repo) });
  const fixture = TestBed.createComponent(GruposListPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await flushRepo();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const filas = (el: HTMLElement) => el.querySelectorAll('tbody tr');

function buscar(fixture: { detectChanges(): void }, el: HTMLElement, texto: string) {
  const input = el.querySelector<HTMLInputElement>('.search-box input')!;
  input.value = texto;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('GruposListPageComponent', () => {
  it('una fila por grupo, con el título armado y el cupo de la próxima sesión', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(2);
    expect(filas(el)[0].textContent).toContain('7ma+8va · Lunes 18:00');
    expect(filas(el)[0].textContent).toContain('Cancha 1');
    expect(filas(el)[0].querySelector('.avatar-sm')!.textContent).toContain('DA');
    expect(filas(el)[0].querySelector('.cupo-num')!.textContent).toContain('3/4');
  });

  it('la búsqueda filtra por TÍTULO del grupo y por profesor', async () => {
    const { fixture, el } = await mount();
    buscar(fixture, el, 'lunes');
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('7ma+8va');

    buscar(fixture, el, 'sofía');
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('6ta');
  });

  it('los chips salen de los datos y filtran por categoría', async () => {
    const { fixture, el } = await mount();
    const chips = el.querySelectorAll<HTMLButtonElement>('.fchip');
    expect(chips).toHaveLength(3);        // 'Todas' + las dos categorías
    expect(chips[0].textContent).toContain('Todas');

    const seisTa = Array.from(chips).find((c) => c.textContent?.trim() === '6ta')!;
    seisTa.click();
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(1);
    expect(seisTa.getAttribute('aria-pressed')).toBe('true');
  });

  it('un template sin día ni hora se lista igual, con guión', async () => {
    // generateSessions saltea estos templates, pero existen y ocupan un id: esconderlos haría
    // que el alta pareciera crear duplicados.
    const { el } = await mount(repoCon([grupo({ weekday: null, startTime: null })]));
    expect(filas(el)[0].textContent).toContain('7ma+8va');
    expect(filas(el)[0].querySelector('.grp-prof.mono')!.textContent).toContain('—');
  });

  it('sin resultados de búsqueda muestra su propio vacío', async () => {
    const { fixture, el } = await mount();
    buscar(fixture, el, 'zzzz');
    expect(el.textContent).toContain('Ningún grupo coincide con la búsqueda');
  });

  it('sin ningún grupo en el club muestra el vacío real, no el de búsqueda', async () => {
    const { el } = await mount(repoCon([]));
    expect(el.textContent).toContain('Todavía no hay grupos en este club');
    expect(el.textContent).not.toContain('Ningún grupo coincide con la búsqueda');
  });

  it('el click en una fila navega al detalle', async () => {
    const { fixture, el } = await mount();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith(['/grupos', '7']);
  });

  it('mientras carga muestra el estado de carga, no la tabla vacía', async () => {
    const lento = {
      listGroups: () => new Promise<Group[]>((r) => setTimeout(() => r([]), 50)),
    } as unknown as GroupsRepository;
    TestBed.configureTestingModule({ providers: providers(lento) });
    const fixture = TestBed.createComponent(GruposListPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando grupos…');
  });

  it('si el repo falla muestra el error en español', async () => {
    const { el } = await mount({
      listGroups: () => Promise.reject({ kind: 'network' as const }),
    } as unknown as GroupsRepository);
    expect(el.textContent).toContain('No se pudieron cargar los grupos');
    expect(el.textContent).toContain('Revisá tu conexión');
    expect(el.textContent).not.toContain('network');
  });

  it('ya no muestra el cartel de datos de demostración', async () => {
    const { el } = await mount();
    expect(el.textContent).not.toContain('Datos de demostración');
  });
});
