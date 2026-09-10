import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpGroupsRepository } from './http-groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';

function setup(over: { sesionesFalla?: boolean } = {}) {
  const calls: string[] = [];
  let rango: readonly string[] = [];

  const schedules = {
    list: async () => {
      calls.push('schedules');
      return [
        {
          id: '7', courtId: '1', coachId: '3', categoryGroupId: '2', sessionTypeId: '1',
          weekday: 1, startTime: '18:00', endTime: '19:30', capacity: 4,
          price: null, active: true, validFrom: null, validTo: null,
        },
      ];
    },
  } as unknown as SchedulesRepository;

  const classSessions = {
    listRange: async (from: string, to: string) => {
      calls.push('listRange');
      rango = [from, to];
      if (over.sesionesFalla) throw new Error('boom');
      return [];
    },
  } as unknown as ClassSessionsRepository;

  const courts = { list: async () => { calls.push('courts'); return []; } } as unknown as CourtsRepository;
  const coaches = { list: async () => { calls.push('coaches'); return []; } } as unknown as CoachesRepository;
  const categoryGroups = {
    list: async () => { calls.push('categoryGroups'); return []; },
  } as unknown as CategoryGroupsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpGroupsRepository,
      { provide: SchedulesRepository, useValue: schedules },
      { provide: ClassSessionsRepository, useValue: classSessions },
      { provide: CourtsRepository, useValue: courts },
      { provide: CoachesRepository, useValue: coaches },
      { provide: CategoryGroupsRepository, useValue: categoryGroups },
    ],
  });
  return { repo: TestBed.inject(HttpGroupsRepository), calls, rango: () => rango };
}

describe('HttpGroupsRepository', () => {
  it('llama a los cinco repositorios, una vez cada uno', async () => {
    const { repo, calls } = setup();
    await repo.listGroups();
    expect([...calls].sort()).toEqual([
      'categoryGroups',
      'coaches',
      'courts',
      'listRange',
      'schedules',
    ]);
  });

  it('pide una ventana de 28 días para atrás y 28 para adelante', async () => {
    const { repo, rango } = setup();
    await repo.listGroups();
    const [from, to] = rango();
    const dias = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    expect(dias).toBe(56);
  });

  // Media pantalla de grupos es peor que un mensaje de error: mismo criterio que el dashboard.
  it('si una de las cinco falla, falla la lista entera', async () => {
    const { repo } = setup({ sesionesFalla: true });
    await expect(repo.listGroups()).rejects.toBeDefined();
  });
});
