import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlanesFacade } from './planes.facade';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Plan, PlanDraft, PlanInput } from '@domain/entities/plan';
import { Coach } from '@domain/entities/coach';
import { PlanCategoriasStore } from './plan-categorias-store';

const plan: Plan = {
  id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: 8, price: '12000', validityDays: 30, active: true,
};

const input: PlanInput = {
  name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: '8', price: '12000', validityDays: '30', active: true,
};

const COACHES: Coach[] = [{ id: '5', displayName: 'Juan Gómez', description: null }];

function setup(over: Partial<PlansRepository> = {}, coachList: () => Promise<Coach[]> = async () => COACHES) {
  const calls: string[] = [];
  const repo = {
    list: async () => { calls.push('list'); return [plan]; },
    create: async (_d: PlanDraft) => { calls.push('create'); },
    update: async (_id: string, _d: PlanDraft) => { calls.push('update'); },
    remove: async (_id: string) => { calls.push('remove'); },
    addCategory: async () => undefined,
    removeCategory: async () => undefined,
    ...over,
  } as PlansRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PlanesFacade,
      { provide: PlansRepository, useValue: repo },
      { provide: CoachesRepository, useValue: { list: coachList } as unknown as CoachesRepository },
      PlanCategoriasStore,
    ],
  });
  const facade = TestBed.inject(PlanesFacade);
  return { facade, calls };
}

describe('PlanesFacade', () => {
  it('load() puebla data()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.data()).toEqual([plan]);
    expect(facade.error()).toBeNull();
  });

  it('create() escribe y después re-lee la lista', async () => {
    const { facade, calls } = setup();
    await facade.create(input);
    expect(calls).toEqual(['create', 'list']);
  });

  it('update() escribe y después re-lee la lista', async () => {
    const { facade, calls } = setup();
    await facade.update('1', input);
    expect(calls).toEqual(['update', 'list']);
  });

  it('remove() borra y después re-lee la lista', async () => {
    const { facade, calls } = setup();
    await facade.remove('1');
    expect(calls).toEqual(['remove', 'list']);
  });

  it('create() sin tipo de plan deja error de dominio y NO llama al repo', async () => {
    // planTypeId es obligatorio también en el PATCH (§3.4): el backend respondería 400 con
    // un mensaje que no dice cuál es el campo.
    const { facade, calls } = setup();
    await facade.create({ ...input, planTypeId: '' });
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({ kind: 'domain', message: 'Elegí un tipo de plan.' });
  });

  it('create() con una cantidad de clases decimal deja error de dominio', async () => {
    const { facade, calls } = setup();
    await facade.create({ ...input, classCount: '2.5' });
    expect(calls).toEqual([]);
    expect(facade.error()).toMatchObject({ kind: 'domain' });
  });

  it('un error de escritura NO borra la lista que ya estaba', async () => {
    const { facade } = setup();
    await facade.load();
    const repo = TestBed.inject(PlansRepository);
    (repo as { create: unknown }).create = () => Promise.reject({ kind: 'network' as const });
    await facade.create(input);
    expect(facade.data()).toEqual([plan]);
  });

  it('sorted() ordena por nombre porque el backend no ordena', async () => {
    const { facade } = setup({
      list: async () => [
        { ...plan, id: '3', name: 'Suelto' },
        { ...plan, id: '1', name: 'Mensual 4' },
      ],
    });
    await facade.load();
    expect(facade.sorted().map((p) => p.name)).toEqual(['Mensual 4', 'Suelto']);
  });

  it('loadCoaches() puebla el lookup', async () => {
    const { facade } = setup();
    await facade.loadCoaches();
    expect(facade.coaches()).toEqual(COACHES);
  });

  it('loadCoaches() falla en SILENCIO: no toca error() ni rompe la pantalla', async () => {
    // Sin profesores el select queda vacío, pero la tabla sigue siendo usable y el error
    // que importa —el de la lista de planes— es el que se muestra.
    const { facade } = setup({}, () => Promise.reject({ kind: 'network' as const }));
    await facade.loadCoaches();
    expect(facade.coaches()).toEqual([]);
    expect(facade.error()).toBeNull();
  });

  it('reset() también limpia el lookup de profesores', async () => {
    // SignalStore.reset() sólo conoce data/loading/error: sin el override, el lookup de
    // profesores del tenant anterior sobreviviría a un reset() de aislamiento de tenant.
    const { facade } = setup();
    await facade.loadCoaches();
    expect(facade.coaches()).toEqual(COACHES);
    facade.reset();
    expect(facade.coaches()).toEqual([]);
  });
});
