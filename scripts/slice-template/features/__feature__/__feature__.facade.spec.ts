import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { __Feature__Facade } from './__feature__.facade';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__ } from '@domain/entities/__entity__';

const row: __Entity__ = { id: '1', name: 'Uno' };

function setup(over: Partial<__Entities__Repository> = {}) {
  const calls: string[] = [];
  const repo = {
    list: async () => { calls.push('list'); return [row]; },
    create: async () => { calls.push('create'); },
    update: async () => { calls.push('update'); },
    remove: async () => { calls.push('remove'); },
    ...over,
  } as __Entities__Repository;
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), __Feature__Facade, { provide: __Entities__Repository, useValue: repo }],
  });
  return { facade: TestBed.inject(__Feature__Facade), calls };
}

describe('__Feature__Facade', () => {
  it('load() puebla data()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.data()).toEqual([row]);
  });

  it('create() escribe y re-lee', async () => {
    const { facade, calls } = setup();
    await facade.create({ name: 'Dos' });
    expect(calls).toEqual(['create', 'list']);
  });

  it('nombre vacío deja error de dominio y NO llama al repo', async () => {
    const { facade, calls } = setup();
    await facade.create({ name: ' ' });
    expect(calls).toEqual([]);
    expect(facade.error()).toMatchObject({ kind: 'domain' });
  });
});
