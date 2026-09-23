import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HorariosFacade } from './horarios.facade';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { Schedule, ScheduleDraft, ScheduleInput, SessionGenerationDraft } from '@domain/entities/schedule';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { CatalogItem } from '@domain/entities/catalog-item';
import { CatalogsRepository } from '@domain/contracts/catalogs.repository';

const ROW: Schedule = {
  id: 'row', courtId: 'c1', coachId: 'p1', categoryGroupId: 'g1', sessionTypeId: '40',
  weekday: 1, startTime: '18:00', endTime: '19:30', capacity: 8, price: '5000',
  active: true, validFrom: null, validTo: null,
};

const INPUT: ScheduleInput = {
  courtId: 'c1', coachId: 'p1', categoryGroupId: 'g1', sessionTypeId: '40',
  weekdays: ['1'], startTime: '18:00', endTime: '19:30', capacity: '8',
  active: true, validFrom: '', validTo: '',
};

const COURT: Court = { id: 'c1', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null };
const COACH: Coach = { id: 'p1', displayName: 'Profe Díaz', description: null };
const GROUP: CategoryGroup = { id: 'g1', name: 'Cuarta/Quinta' };
const SESSION_TYPE: CatalogItem = { id: '40', name: 'grupal' };

interface LookupOverrides {
  courts?: Partial<CourtsRepository>;
  coaches?: Partial<CoachesRepository>;
  categoryGroups?: Partial<CategoryGroupsRepository>;
  catalogs?: Partial<CatalogsRepository>;
}

function setup(
  scheduleOver: Partial<SchedulesRepository> = {},
  lookupOver: LookupOverrides = {},
): { facade: HorariosFacade; calls: string[] } {
  const calls: string[] = [];
  // Sólo .list() de courts/coaches/categoryGroups: HorariosFacade nunca llama a sus otros
  // métodos (create/update/remove son de CanchasFacade, ProfesoresFacade y
  // GruposCategoriaFacade), así que el mock parcial no los necesita — de ahí el
  // `as unknown as X` en vez de `as X`.
  const schedulesRepo = {
    list: async () => { calls.push('list'); return [ROW]; },
    create: async (_d: ScheduleDraft) => { calls.push('create'); },
    update: async (_id: string, _d: ScheduleDraft) => { calls.push('update'); },
    remove: async (_id: string) => { calls.push('remove'); },
    generateSessions: async (_d: SessionGenerationDraft) => ({ created: 0, skipped: 0 }),
    ...scheduleOver,
  } as unknown as SchedulesRepository;

  const courtsRepo = {
    list: async () => [COURT],
    ...lookupOver.courts,
  } as unknown as CourtsRepository;

  const coachesRepo = {
    list: async () => [COACH],
    ...lookupOver.coaches,
  } as unknown as CoachesRepository;

  const categoryGroupsRepo = {
    list: async () => [GROUP],
    ...lookupOver.categoryGroups,
  } as unknown as CategoryGroupsRepository;

  const catalogsFacade = {
    sessionTypes: async () => [SESSION_TYPE],
    ...lookupOver.catalogs,
  } as unknown as CatalogsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HorariosFacade,
      { provide: SchedulesRepository, useValue: schedulesRepo },
      { provide: CourtsRepository, useValue: courtsRepo },
      { provide: CoachesRepository, useValue: coachesRepo },
      { provide: CategoryGroupsRepository, useValue: categoryGroupsRepo },
      { provide: CatalogsRepository, useValue: catalogsFacade },
    ],
  });
  return { facade: TestBed.inject(HorariosFacade), calls };
}

describe('HorariosFacade', () => {
  it('load() puebla data()', async () => {
    const { facade: f } = setup();
    await f.load();
    expect(f.data()).toEqual([ROW]);
    expect(f.error()).toBeNull();
  });

  it('create() escribe y después re-lee la lista', async () => {
    const { facade: f, calls } = setup();
    await f.create(INPUT);
    expect(calls).toEqual(['create', 'list']);
    expect(f.data()).toEqual([ROW]);
    expect(f.error()).toBeNull();
  });

  it('update() escribe y después re-lee la lista', async () => {
    const { facade: f, calls } = setup();
    await f.update('row', INPUT);
    expect(calls).toEqual(['update', 'list']);
    expect(f.data()).toEqual([ROW]);
    expect(f.error()).toBeNull();
  });

  it('remove() borra y después re-lee la lista', async () => {
    const { facade: f, calls } = setup();
    await f.remove('row');
    expect(calls).toEqual(['remove', 'list']);
    expect(f.data()).toEqual([ROW]);
    expect(f.error()).toBeNull();
  });

  it('loadLookups() puebla los cuatro lookups a la vez', async () => {
    const { facade: f } = setup();
    await f.loadLookups();
    expect(f.courts()).toEqual([COURT]);
    expect(f.coaches()).toEqual([COACH]);
    expect(f.categoryGroups()).toEqual([GROUP]);
    expect(f.sessionTypes()).toEqual([SESSION_TYPE]);
  });

  it('clearError() limpia el error de la lista', async () => {
    const { facade: f } = setup({ list: async () => { throw { kind: 'network' }; } });
    await f.load();
    expect(f.error()).not.toBeNull();
    f.clearError();
    expect(f.error()).toBeNull();
  });

  it('sorted() ordena por semana ARGENTINA: domingo al final', async () => {
    // (weekday + 6) % 7. Sin esto, el 0 del backend (domingo) encabezaría la tabla.
    const { facade: f } = setup({ list: async () => [
      { ...ROW, id: 'dom', weekday: 0, startTime: '10:00' },
      { ...ROW, id: 'lun', weekday: 1, startTime: '18:00' },
      { ...ROW, id: 'sab', weekday: 6, startTime: '09:00' },
    ] });
    await f.load();
    expect(f.sorted().map((s) => s.id)).toEqual(['lun', 'sab', 'dom']);
  });

  it('sorted() desempata por hora de inicio dentro del mismo día', async () => {
    const { facade: f } = setup({ list: async () => [
      { ...ROW, id: 'tarde', weekday: 1, startTime: '19:30' },
      { ...ROW, id: 'temprano', weekday: 1, startTime: '18:00' },
    ] });
    await f.load();
    expect(f.sorted().map((s) => s.id)).toEqual(['temprano', 'tarde']);
  });

  it('sorted() manda las filas SIN día al final de todo', async () => {
    const { facade: f } = setup({ list: async () => [
      { ...ROW, id: 'sin-dia', weekday: null, startTime: null },
      { ...ROW, id: 'dom', weekday: 0, startTime: '10:00' },
    ] });
    await f.load();
    expect(f.sorted().map((s) => s.id)).toEqual(['dom', 'sin-dia']);
  });

  it('los cuatro lookups fallan en SILENCIO y no tocan error()', async () => {
    // Misma política que Canchas y Planes: sin canchas el select queda vacío, pero la tabla
    // sigue usable y el error que importa —el de la lista— es el que se muestra.
    const { facade: f } = setup({ list: async () => [ROW] }, {
      courts: { list: async () => { throw new Error('x'); } },
      coaches: { list: async () => { throw new Error('x'); } },
    });
    await f.load();
    await f.loadLookups();
    expect(f.courts()).toEqual([]);
    expect(f.coaches()).toEqual([]);
    expect(f.error()).toBeNull();
  });

  it('reset() limpia los cuatro lookups Y generating/generateError, las SEIS piezas propias', async () => {
    // generateError se llega a poblar haciendo fallar un generate() DE VERDAD (no tocando la
    // señal a mano): es la única forma de probar que reset() limpia lo que generate() escribe.
    const { facade: f } = setup({
      list: async () => [ROW],
      generateSessions: async () => { throw { kind: 'network' }; },
    });
    await f.load();
    await f.loadLookups();
    await f.generate({ from: '2026-08-03', to: '2026-08-30' });
    expect(f.courts().length).toBeGreaterThan(0);
    expect(f.generateError()).not.toBeNull();
    f.reset();
    expect(f.data()).toBeNull();
    expect(f.courts()).toEqual([]);
    expect(f.coaches()).toEqual([]);
    expect(f.categoryGroups()).toEqual([]);
    expect(f.sessionTypes()).toEqual([]);
    expect(f.generating()).toBe(false);
    expect(f.generateError()).toBeNull();
  });

  it('generate() devuelve las dos cifras y NO toca data() ni error()', async () => {
    // No pasa por run(): run() escribe en data(), loading() y error(), y un fallo al
    // generar no puede borrar ni tapar la lista de horarios.
    const { facade: f } = setup({ list: async () => [ROW], generateSessions: async () => ({ created: 12, skipped: 3 }) });
    await f.load();
    const antes = f.data();
    const r = await f.generate({ from: '2026-08-03', to: '2026-08-30' });
    expect(r).toEqual({ created: 12, skipped: 3 });
    expect(f.data()).toBe(antes);
    expect(f.error()).toBeNull();
  });

  it('generate() que falla devuelve null y deja el error en generateError()', async () => {
    const { facade: f } = setup({ list: async () => [ROW], generateSessions: async () => { throw { kind: 'network' }; } });
    await f.load();
    expect(await f.generate({ from: '2026-08-03', to: '2026-08-30' })).toBeNull();
    expect(f.generateError()).toEqual({ kind: 'network' });
    expect(f.error()).toBeNull();
  });

  it('generate() con un rango de más de 60 días no llama al repo', async () => {
    // createSessionGenerationDraft tira SÍNCRONO; va dentro de la promesa para que
    // asDomainError lo normalice igual que un fallo del repo.
    let llamado = false;
    const { facade: f } = setup({ list: async () => [ROW], generateSessions: async () => { llamado = true; return { created: 0, skipped: 0 }; } });
    const r = await f.generate({ from: '2026-01-01', to: '2026-12-31' });
    expect(r).toBeNull();
    expect(llamado).toBe(false);
    expect(f.generateError()).toEqual({ kind: 'domain', message: expect.stringMatching(/60 días/) });
    // El finally lo garantiza estructuralmente, pero la aserción explícita cubre el camino
    // de error SÍNCRONO igual que el de error de red: generating() no puede quedar en true.
    expect(f.generating()).toBe(false);
  });

  it('generating() está en true mientras la request está en vuelo', async () => {
    let resolver: (v: { created: number; skipped: number }) => void = () => undefined;
    const { facade: f } = setup({ list: async () => [ROW], generateSessions: () => new Promise((res) => { resolver = res; }) });
    const p = f.generate({ from: '2026-08-03', to: '2026-08-30' });
    expect(f.generating()).toBe(true);
    resolver({ created: 1, skipped: 0 });
    await p;
    expect(f.generating()).toBe(false);
  });

  it('clearGenerateError() limpia sólo el error de generación', async () => {
    const { facade: f } = setup({ list: async () => [ROW], generateSessions: async () => { throw { kind: 'network' }; } });
    await f.generate({ from: '2026-08-03', to: '2026-08-30' });
    f.clearGenerateError();
    expect(f.generateError()).toBeNull();
  });
});

describe('HorariosFacade.create · éxito parcial y ventana de doble submit', () => {
  it('con un día fallado publica los que SÍ entraron, y los cuenta', async () => {
    // Regresión: con Promise.all + run(), el rechazo dejaba data() intacto y creados en 0.
    // La tabla no mostraba los dos que habían entrado y reintentar los duplicaba: el backend
    // no tiene @@unique (§3.11).
    const creados: number[] = [];
    let listas = 0;
    const { facade } = setup({
      create: async (d: ScheduleDraft) => {
        if (d.weekday === 3) throw { kind: 'network' };
        creados.push(d.weekday);
      },
      list: async () => { listas += 1; return [ROW]; },
    });

    const out = await facade.create({ ...INPUT, weekdays: ['1', '3', '5'] });

    expect(creados.sort()).toEqual([1, 5]);
    expect(out.creados).toBe(2);
    expect(facade.error()).not.toBeNull();
    // Releyó pese al fallo: los dos que entraron tienen que estar en la tabla.
    expect(listas).toBe(1);
    expect(facade.data()).toEqual([ROW]);
  });

  it('si NINGUNO entra no relee y no publica nada: reintentar es seguro', async () => {
    let listas = 0;
    const { facade } = setup({
      create: async () => { throw { kind: 'network' }; },
      list: async () => { listas += 1; return [ROW]; },
    });

    const out = await facade.create({ ...INPUT, weekdays: ['1', '3'] });

    expect(out.creados).toBe(0);
    expect(listas).toBe(0);
    expect(facade.error()).not.toBeNull();
  });

  it('loading() sigue en true mientras se generan las clases', async () => {
    // Regresión: run() lo apagaba al terminar los POST, pero el modal queda abierto durante
    // toda la generación. Con el botón Guardar habilitado en esa ventana, un segundo click
    // creaba el juego de horarios de nuevo.
    let soltarGeneracion!: (r: { created: number; skipped: number }) => void;
    let loadingDuranteGeneracion: boolean | null = null;
    const { facade } = setup({
      generateSessions: () =>
        new Promise((resolve) => {
          loadingDuranteGeneracion = facade.loading();
          soltarGeneracion = resolve;
        }),
    });

    const pendiente = facade.create(INPUT);
    // Un microtask por cada await del camino hasta el generateSessions.
    for (let i = 0; i < 12; i += 1) await Promise.resolve();

    expect(loadingDuranteGeneracion).toBe(true);
    expect(facade.loading()).toBe(true);
    soltarGeneracion({ created: 4, skipped: 0 });
    await pendiente;
    expect(facade.loading()).toBe(false);
  });

  it('el alta sin días no toca el repo y deja el error del dominio', async () => {
    const { facade, calls } = setup();
    const out = await facade.create({ ...INPUT, weekdays: [] });
    expect(out).toEqual({ creados: 0, generacion: null });
    expect(calls).toEqual([]);
    expect(facade.error()).not.toBeNull();
  });
});
