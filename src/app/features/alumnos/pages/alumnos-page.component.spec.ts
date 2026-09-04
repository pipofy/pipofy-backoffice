import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection} from '@angular/core';
import { AlumnosPageComponent } from './alumnos-page.component';
import { AlumnosFacade } from '../alumnos.facade';
import { AlumnoPlanesFacade } from '../alumno-planes.facade';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { Student, StudentDraft } from '@domain/entities/student';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';

const ALUMNO: Student = {
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '5', studentStatusId: '2',
  dominantHand: 'zurdo', ranking: 12, notes: null,
};

const CATALOGS_DOUBLE = {
  paymentMethods: async () => [{ id: '3', name: 'efectivo' }],
  studentStatuses: async () => [
    { id: '1', name: 'active' },
    { id: '2', name: 'pending_classification' },
  ],
} as unknown as CatalogsRepository;

async function settle(fixture: ComponentFixture<AlumnosPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<StudentsRepository> = {}, catalogs = CATALOGS_DOUBLE) {
  const repo = {
    list: async () => [ALUMNO],
    create: async (_d: StudentDraft) => undefined,
    update: async (_id: string, _d: StudentDraft) => undefined,
    remove: async (_id: string) => undefined,
    plans: async (_id: string) => [],
    ...over,
  } as StudentsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      AlumnosFacade,
      // El modal de planes se renderiza siempre (cerrado) y trae su propia facade, que a su
      // vez necesita PlansRepository para resolver nombres.
      AlumnoPlanesFacade,
      { provide: CatalogsRepository, useValue: catalogs },
      { provide: StudentsRepository, useValue: repo },
      {
        provide: CategoriesRepository,
        useValue: { list: async () => [{ id: '5', name: 'Quinta', levelOrder: 5 }] },
      },
      { provide: PlansRepository, useValue: { list: async () => [] } },
    ],
  });
  const fixture = TestBed.createComponent(AlumnosPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const filas = (el: HTMLElement) => Array.from(el.querySelectorAll('tbody tr'));
/** Columna Estado: Alumno, Teléfono, Categoría, ESTADO, Mano, Ranking, Acciones. */
const estado = (el: HTMLElement) => filas(el)[0].querySelectorAll('td')[3].textContent?.trim();
const buscador = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#alumnos-q')!;

describe('AlumnosPageComponent', () => {
  it('renderiza el alumno como "Apellido, Nombre" con su categoría resuelta', async () => {
    const { el } = await mount();
    expect(filas(el)[0].textContent).toContain('Pérez, Ana');
    expect(filas(el)[0].textContent).toContain('Quinta');
  });

  it('un alumno sin nombre se muestra por su teléfono', async () => {
    const { el } = await mount({ list: async () => [{ ...ALUMNO, firstName: '', lastName: '' }] });
    expect(filas(el)[0].textContent).toContain('1155667788');
  });

  it('muestra el estado humanizado, no el id crudo', async () => {
    // 'pending_classification' es el alumno que entró por WhatsApp y todavía no tiene
    // categoría: hasta esta conexión el panel no lo distinguía de uno activo.
    const { el } = await mount();
    expect(estado(el)).toBe('Sin clasificar');
  });

  it('si el catálogo de estados no cargó, la columna muestra una raya y no el id', async () => {
    const { el } = await mount({}, {
      paymentMethods: async () => [],
      studentStatuses: () => Promise.reject({ kind: 'network' as const }),
    } as unknown as CatalogsRepository);
    // La celda, no la fila entera: el ranking (12) también contiene el id '2'.
    expect(estado(el)).toBe('—');
  });

  it('un alumno sin categoría muestra una raya', async () => {
    const { el } = await mount({ list: async () => [{ ...ALUMNO, categoryId: null }] });
    expect(filas(el)[0].textContent).toContain('—');
  });

  it('el buscador filtra por apellido', async () => {
    const { fixture, el } = await mount({
      list: async () => [ALUMNO, { ...ALUMNO, id: '2', lastName: 'Gómez', firstName: 'Beto' }],
    });
    buscador(el).value = 'gómez';
    buscador(el).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(1);
  });

  it('el buscador también filtra por teléfono', async () => {
    // Es el único dato que TODO alumno tiene: el backend sólo exige phone.
    const { fixture, el } = await mount({
      list: async () => [ALUMNO, { ...ALUMNO, id: '2', phone: '1199887766', lastName: 'Gómez' }],
    });
    buscador(el).value = '9988';
    buscador(el).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(1);
  });

  it('si la carga FALLA muestra el banner y NO el vacío', async () => {
    const { el } = await mount({ list: () => Promise.reject({ kind: 'forbidden' as const }) });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    // Acotado al panel: el modal de planes tiene su propio vacío y vive fuera del <section>.
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ningún alumno');
  });

  it('el vacío distingue "sin datos" de "sin resultados"', async () => {
    const { fixture, el } = await mount({ list: async () => [] });
    expect(el.textContent).toContain('Todavía no cargaste ningún alumno');

    buscador(el).value = 'nadie coincide';
    buscador(el).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.textContent).toContain('Ningún alumno coincide con la búsqueda');
  });

  it('un error de guardado NO reemplaza la tabla y deja el modal abierto', async () => {
    // El teléfono se escribe a propósito: sin él createStudentDraft tira la invariante y el
    // repo nunca se llama, así que el test pasaría probando otra cosa que la que dice.
    const { fixture, el } = await mount({
      create: () => Promise.reject({
        kind: 'domain' as const,
        message: 'Ya existe un alumno con ese teléfono en este club',
      }),
    });
    el.querySelector<HTMLButtonElement>('.panel-head .btn-primary')!.click();
    fixture.detectChanges();
    const tel = el.querySelector<HTMLInputElement>('#alumno-telefono')!;
    tel.value = '1155667788';
    tel.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="save"]')!.click();
    await settle(fixture);

    expect(filas(el)).toHaveLength(1);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Ya existe un alumno');
    expect(el.querySelector<HTMLDialogElement>('app-alumno-form-modal dialog')!.open).toBe(true);
  });

  it('el botón Planes abre el modal con los planes DE ESE alumno', async () => {
    let pedido = '';
    const { fixture, el } = await mount({
      plans: async (id: string) => {
        pedido = id;
        return [{ id: '9', planId: '10', purchasedAt: '2026-08-01', creditsTotal: 8, creditsRemaining: 5, expiresAt: null }];
      },
    });

    const planes = [...filas(el)[0].querySelectorAll('button')].find((b) => b.textContent?.includes('Planes'))!;
    planes.click();
    await settle(fixture);

    expect(pedido).toBe('1');   // el id del alumno de la fila, no otro
    expect(el.querySelector<HTMLDialogElement>('app-alumno-planes-modal dialog')!.open).toBe(true);
    expect(el.querySelector('[data-test="creditos-totales"]')!.textContent).toContain('5');
  });
});
