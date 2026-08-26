import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AlumnosFacade } from './alumnos.facade';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Student, StudentDraft, StudentInput } from '@domain/entities/student';
import { Category } from '@domain/entities/category';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';

const alumno: Student = {
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: 12, notes: null,
};

const input: StudentInput = {
  phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: '12', notes: '',
};

const CATEGORIAS: Category[] = [{ id: '4', name: 'Cuarta', levelOrder: 4 }];
const ESTADOS = [{ id: '1', name: 'active' }, { id: '2', name: 'pending_classification' }];

function setup(
  over: Partial<StudentsRepository> = {},
  categoryList: () => Promise<Category[]> = async () => CATEGORIAS,
  statusList: () => Promise<{ id: string; name: string }[]> = async () => ESTADOS,
) {
  const calls: string[] = [];
  const repo = {
    list: async () => { calls.push('list'); return [alumno]; },
    create: async (_d: StudentDraft) => { calls.push('create'); },
    update: async (_id: string, _d: StudentDraft) => { calls.push('update'); },
    remove: async (_id: string) => { calls.push('remove'); },
    ...over,
  } as StudentsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      AlumnosFacade,
      { provide: StudentsRepository, useValue: repo },
      { provide: CategoriesRepository, useValue: { list: categoryList } as CategoriesRepository },
      { provide: CatalogsRepository, useValue: { studentStatuses: statusList } as unknown as CatalogsRepository },
    ],
  });
  return { facade: TestBed.inject(AlumnosFacade), calls };
}

describe('AlumnosFacade', () => {
  it('load() puebla data()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.data()).toEqual([alumno]);
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

  it('create() sin teléfono deja error de dominio y NO llama al repo', async () => {
    const { facade, calls } = setup();
    await facade.create({ ...input, phone: '  ' });
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({ kind: 'domain', message: 'El teléfono es obligatorio.' });
  });

  it('un teléfono duplicado llega con el copy del backend', async () => {
    // @@unique([clubId, phone]) → P2002 → 409 (§3.7).
    const { facade } = setup({
      create: () => Promise.reject({
        kind: 'domain' as const,
        message: 'Ya existe un alumno con ese teléfono en este club',
      }),
    });
    await facade.create(input);
    expect(facade.error()).toEqual({
      kind: 'domain', message: 'Ya existe un alumno con ese teléfono en este club',
    });
  });

  it('un error de escritura NO borra la lista que ya estaba', async () => {
    const { facade } = setup();
    await facade.load();
    const repo = TestBed.inject(StudentsRepository);
    (repo as { update: unknown }).update = () => Promise.reject({ kind: 'network' as const });
    await facade.update('1', input);
    expect(facade.data()).toEqual([alumno]);
  });

  it('sorted() ordena por apellido y después nombre', async () => {
    const { facade } = setup({
      list: async () => [
        { ...alumno, id: '3', lastName: 'Pérez', firstName: 'Beto' },
        { ...alumno, id: '1', lastName: 'Álvarez', firstName: 'Zoe' },
        { ...alumno, id: '2', lastName: 'Pérez', firstName: 'Ana' },
      ],
    });
    await facade.load();
    expect(facade.sorted().map((s) => s.id)).toEqual(['1', '2', '3']);
  });

  it('sorted() manda al final a los que no tienen nombre cargado', async () => {
    // El backend sólo exige phone: hay alumnos sin nombre, y ordenarlos por '' los pondría
    // primeros aunque son las filas con menos información.
    const { facade } = setup({
      list: async () => [
        { ...alumno, id: '2', lastName: '', firstName: '' },
        { ...alumno, id: '1', lastName: 'Pérez', firstName: 'Ana' },
      ],
    });
    await facade.load();
    expect(facade.sorted().map((s) => s.id)).toEqual(['1', '2']);
  });

  it('loadCategories() puebla el lookup', async () => {
    const { facade } = setup();
    await facade.loadCategories();
    expect(facade.categories()).toEqual(CATEGORIAS);
  });

  it('loadCategories() falla en SILENCIO: no toca error()', async () => {
    const { facade } = setup({}, () => Promise.reject({ kind: 'network' as const }));
    await facade.loadCategories();
    expect(facade.categories()).toEqual([]);
    expect(facade.error()).toBeNull();
  });

  it('loadStatuses() puebla el lookup de estados', async () => {
    const { facade } = setup();
    await facade.loadStatuses();
    expect(facade.statuses()).toEqual(ESTADOS);
  });

  it('loadStatuses() falla en SILENCIO, igual que las categorías', async () => {
    const { facade } = setup({}, undefined, () => Promise.reject({ kind: 'network' as const }));
    await facade.loadStatuses();
    expect(facade.statuses()).toEqual([]);
    expect(facade.error()).toBeNull();
  });

  it('reset() también limpia el lookup de categorías', async () => {
    // SignalStore.reset() sólo conoce data/loading/error: sin el override, el lookup de
    // categorías del tenant anterior sobreviviría a un reset() de aislamiento de tenant.
    const { facade } = setup();
    await facade.loadCategories();
    expect(facade.categories()).toEqual(CATEGORIAS);
    facade.reset();
    expect(facade.categories()).toEqual([]);
  });

  it('reset() también limpia el lookup de estados', async () => {
    const { facade } = setup();
    await facade.loadStatuses();
    facade.reset();
    expect(facade.statuses()).toEqual([]);
  });
});
