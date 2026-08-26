import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlanCategoriasFacade } from './plan-categorias.facade';
import { PlanCategoriasStore } from './plan-categorias-store';
import { PlansRepository } from '@domain/contracts/plans.repository';

function setup(over: Partial<PlansRepository> = {}) {
  const calls: string[] = [];
  const repo = {
    addCategory: async (_p: string, c: string) => { calls.push(`add:${c}`); },
    removeCategory: async (_p: string, c: string) => { calls.push(`remove:${c}`); },
    ...over,
  } as PlansRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PlanCategoriasFacade,
      PlanCategoriasStore,
      { provide: PlansRepository, useValue: repo },
    ],
  });
  return { facade: TestBed.inject(PlanCategoriasFacade), calls };
}

describe('PlanCategoriasFacade', () => {
  beforeEach(() => localStorage.clear());

  it('open() siembra la selección con la pista guardada', () => {
    const { facade } = setup();
    TestBed.inject(PlanCategoriasStore).write('7', ['1', '3']);
    facade.open('7');
    expect(facade.selected()).toEqual(['1', '3']);
  });

  it('open() limpia un error viejo: el modal se reabre en limpio', () => {
    const { facade } = setup({ addCategory: () => Promise.reject({ kind: 'forbidden' as const }) });
    facade.open('7');
    return facade.toggle('3', true).then(() => {
      expect(facade.error()).not.toBeNull();
      facade.open('7');
      expect(facade.error()).toBeNull();
    });
  });

  it('tildar agrega, persiste la pista y no deja error', async () => {
    const { facade, calls } = setup();
    facade.open('7');
    await facade.toggle('3', true);
    expect(calls).toEqual(['add:3']);
    expect(facade.selected()).toEqual(['3']);
    expect(TestBed.inject(PlanCategoriasStore).read('7')).toEqual(['3']);
    expect(facade.error()).toBeNull();
  });

  it('destildar quita y persiste', async () => {
    const { facade, calls } = setup();
    TestBed.inject(PlanCategoriasStore).write('7', ['1', '3']);
    facade.open('7');
    await facade.toggle('1', false);
    expect(calls).toEqual(['remove:1']);
    expect(facade.selected()).toEqual(['3']);
    expect(TestBed.inject(PlanCategoriasStore).read('7')).toEqual(['3']);
  });

  it('si la escritura falla, la selección VUELVE atrás y queda el error', async () => {
    // Sin el rollback la checkbox mentiría con una categoría que la API rechazó — y en planes
    // esa mentira termina en un 400 al vender, que es donde más caro sale.
    const { facade } = setup({
      addCategory: () => Promise.reject({ kind: 'forbidden' as const }),
    });
    facade.open('7');
    await facade.toggle('3', true);
    expect(facade.selected()).toEqual([]);
    expect(facade.error()).toEqual({ kind: 'forbidden' });
    expect(TestBed.inject(PlanCategoriasStore).read('7')).toEqual([]);
  });

  it('toggle() sin open() previo no hace nada', () => {
    const { facade, calls } = setup();
    return facade.toggle('3', true).then(() => expect(calls).toEqual([]));
  });
});
