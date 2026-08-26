import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection} from '@angular/core';
import { AlumnoPlanesFacade } from './alumno-planes.facade';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { StudentPlan } from '@domain/entities/student-plan';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { Plan } from '@domain/entities/plan';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';

const CATALOGS_DOUBLE = {
  paymentMethods: async () => [{ id: '3', name: 'efectivo' }],
} as unknown as CatalogsRepository;

function setup(repo: Partial<StudentsRepository>, plansRepo: Partial<PlansRepository> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      AlumnoPlanesFacade,
      { provide: CatalogsRepository, useValue: CATALOGS_DOUBLE },
      { provide: StudentsRepository, useValue: repo },
      { provide: PlansRepository, useValue: { list: async () => [], ...plansRepo } },
    ],
  });
  return TestBed.inject(AlumnoPlanesFacade);
}

const plan = (over: Partial<StudentPlan> = {}): StudentPlan => ({
  id: '1', planId: '10', purchasedAt: '2026-08-01',
  creditsTotal: 8, creditsRemaining: 5, expiresAt: '2099-01-01', ...over,
});

describe('AlumnoPlanesFacade', () => {
  it('load() pide los planes del alumno indicado', async () => {
    let pedido = '';
    const f = setup({ plans: async (id: string) => { pedido = id; return [plan()]; } });
    await f.load('7');
    expect(pedido).toBe('7');
    expect(f.data()).toHaveLength(1);
  });

  it('credits() suma sólo lo utilizable hoy, no el total de las filas', async () => {
    const f = setup({
      plans: async () => [
        plan({ id: '1', creditsRemaining: 5 }),
        plan({ id: '2', creditsRemaining: 3, expiresAt: '2020-01-01' }),  // vencido
      ],
    });
    await f.load('7');
    expect(f.credits()).toBe(5);
  });

  it('un fallo del repo deja el error y no rompe credits()', async () => {
    const f = setup({ plans: () => Promise.reject({ kind: 'network' as const }) });
    await f.load('7');
    expect(f.error()).toEqual({ kind: 'network' });
    expect(f.credits()).toBe(0);
  });

  // La API devuelve planId, no el nombre del plan: sin el lookup la tabla muestra un número.
  it('planName() resuelve el nombre desde la lista de planes', async () => {
    const planes = [{ id: '10', name: 'Mensual 8 clases' } as Plan];
    const f = setup({ plans: async () => [plan()] }, { list: async () => planes });
    await f.load('7');
    expect(f.planName('10')).toBe('Mensual 8 clases');
  });

  // Misma política que AlumnosFacade.loadCategories(): sin nombres la tabla sigue siendo
  // usable y el error que importa es el de los planes del alumno.
  it('si falla la lista de planes, planName() degrada sin tumbar la pantalla', async () => {
    const f = setup({ plans: async () => [plan()] }, { list: () => Promise.reject(new Error('x')) });
    await f.load('7');
    expect(f.error()).toBeNull();
    expect(f.planName('10')).toBe('Plan #10');
  });

  // La facade es scoped a la ruta: revisar diez alumnos seguidos pedía diez veces la misma
  // lista, que no cambia mientras dure la pantalla.
  it('el catálogo de planes se pide UNA vez, aunque se abran varios alumnos', async () => {
    let pedidos = 0;
    const f = setup(
      { plans: async () => [plan()] },
      { list: async () => { pedidos++; return [{ id: '10', name: 'Mensual' } as Plan]; } },
    );
    await f.load('7');
    await f.load('8');
    await f.load('9');
    expect(pedidos).toBe(1);
    expect(f.planName('10')).toBe('Mensual');
  });

  // isExpired() delega en el dominio: la copia local ignoraba los créditos y decía que un
  // plan agotado seguía vigente mientras el encabezado marcaba 0.
  it('isExpired() mira sólo la fecha y NO contradice a credits()', async () => {
    const f = setup({ plans: async () => [plan({ creditsRemaining: 0 })] });
    await f.load('7');
    expect(f.isExpired(plan({ creditsRemaining: 0 }))).toBe(false);
    expect(f.credits()).toBe(0);
  });
});
