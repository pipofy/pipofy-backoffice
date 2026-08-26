import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { GruposListPageComponent } from './grupos-list-page.component';
import { GruposFacade } from '../grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { InMemoryGroupsRepository } from '@data/repositories/in-memory-groups.repository';
import { SessionStore } from '@data/auth/session-store';

/** Doble mínimo: SessionStore está bindeado en root, así que el TestBed no lo provee solo. */
const sessionStoreStub = { provide: SessionStore, useValue: { clubId: signal<string | null>('c1') } };

/** Salto de MACROTAREA. whenStable() cede UN tick de microtarea y sólo espera el PendingTasks
 *  de Angular: la cadena load()→run()→setData() no está registrada ahí. Sin esto los asserts
 *  corren antes de que exista la pantalla. Ver dashboard-page.component.spec.ts:31-37. */
const flushRepo = () => new Promise((r) => setTimeout(r, 0));

async function mount(repo: GroupsRepository = new InMemoryGroupsRepository(0)) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      GruposFacade,
      { provide: GroupsRepository, useValue: repo },
      sessionStoreStub,
    ],
  });
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
  it('renderiza una fila por grupo de la semilla', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(6);
    expect(filas(el)[0].textContent).toContain('7ma+8va · Lunes PM');
    expect(filas(el)[0].textContent).toContain('Cancha 1');
    expect(filas(el)[0].querySelector('.cat-badge')!.textContent).toContain('7ma+8va');
    expect(filas(el)[0].querySelector('.cupo-num')!.textContent).toContain('4/4');
  });

  it('muestra el contador de lista de espera cuando hay gente esperando', async () => {
    const { el } = await mount();
    expect(filas(el)[0].textContent).toContain('1 en espera');
    expect(filas(el)[1].textContent).not.toContain('en espera');
  });

  it('la búsqueda filtra por NOMBRE de grupo', async () => {
    const { fixture, el } = await mount();
    buscar(fixture, el, 'damas');
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('Damas · 6ta');
  });

  it('la búsqueda filtra también por NOMBRE DE PROFESOR', async () => {
    const { fixture, el } = await mount();
    buscar(fixture, el, 'sofía');
    expect(filas(el)).toHaveLength(3);      // grupos 2, 5 y 6
  });

  it('los chips salen de los datos y filtran por categoría', async () => {
    const { fixture, el } = await mount();
    const chips = el.querySelectorAll<HTMLButtonElement>('.fchip');
    // 'Todas' + las 5 categorías distintas de la semilla
    expect(chips).toHaveLength(6);
    expect(chips[0].textContent).toContain('Todas');
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');

    const seisTa = Array.from(chips).find((c) => c.textContent?.trim() === '6ta')!;
    seisTa.click();
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(2);       // grupos 2 y 5
    expect(seisTa.getAttribute('aria-pressed')).toBe('true');
  });

  it('sin resultados muestra el empty state', async () => {
    const { fixture, el } = await mount();
    buscar(fixture, el, 'zzzz');
    expect(el.textContent).toContain('Sin grupos para esa búsqueda');
  });

  it('el click en una fila navega al detalle', async () => {
    const { fixture, el } = await mount();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith(['/grupos', '1']);
  });

  it('mientras carga muestra el estado de carga, no la tabla vacía', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        GruposFacade,
        { provide: GroupsRepository, useValue: new InMemoryGroupsRepository(50) },
        sessionStoreStub,
      ],
    });
    const fixture = TestBed.createComponent(GruposListPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cargando grupos…');
  });

  it('si el repo falla muestra el error en español', async () => {
    const { el } = await mount({
      getGroups: () => Promise.reject({ kind: 'network' as const }),
      saveAttendance: () => Promise.reject(new Error('no')),
    });
    expect(el.textContent).toContain('No se pudo cargar los grupos');
    expect(el.textContent).toContain('Revisá tu conexión');
    expect(el.textContent).not.toContain('network');
  });

  it('declara que los datos son de demostración', async () => {
    // La semilla se queda (borrarla dejaría la pantalla rota sin ganar nada), pero no puede
    // verse igual de sana que una pantalla conectada.
    const { el } = await mount();
    const aviso = el.querySelector('.notice');
    expect(aviso?.textContent).toContain('Datos de demostración');
    expect(aviso?.textContent).toContain('endpoint de asistencia');
  });
});
