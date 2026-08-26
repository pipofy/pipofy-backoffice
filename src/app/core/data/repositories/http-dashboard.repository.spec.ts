import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpDashboardRepository } from './http-dashboard.repository';
import { CatalogsRepository } from './catalogs.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
import { WaitingListEntry } from '@domain/entities/waiting-list';

const court = {
  id: '1',
  name: 'Cancha 1',
  code: null,
  surfaceTypeId: null,
  indoor: true,
  courtStatusId: null,
};

const session = (over: Partial<ClassSession> = {}): ClassSession => ({
  id: '10',
  courtId: '1',
  coachId: '2',
  categoryGroupId: '3',
  startAt: new Date().toISOString(),
  capacity: 4,
  availableSpots: 1,
  ...over,
});

function setup(
  sessions: readonly ClassSession[] = [session()],
  waiting: readonly WaitingListEntry[] = [],
  overrides: Partial<ClassSessionsRepository> = {},
) {
  const waitingListCalls: string[] = [];
  const classSessions = {
    list: async (_dateKey: string) => sessions,
    waitingList: async (id: string) => {
      waitingListCalls.push(id);
      return waiting;
    },
    reservations: async () => [],
    joinWaitingList: async () => undefined,
    leaveWaitingList: async () => undefined,
    cancel: async () => undefined,
    cancelDay: async () => undefined,
    ...overrides,
  } as ClassSessionsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpDashboardRepository,
      { provide: ClassSessionsRepository, useValue: classSessions },
      { provide: CourtsRepository, useValue: { list: async () => [court] } },
      {
        provide: CoachesRepository,
        useValue: { list: async () => [{ id: '2', displayName: 'Diego A.', description: null }] },
      },
      {
        provide: CategoryGroupsRepository,
        useValue: { list: async () => [{ id: '3', name: '7ma' }] },
      },
      { provide: CatalogsRepository, useValue: { surfaceTypes: async () => [] } },
    ],
  });
  return { repo: TestBed.inject(HttpDashboardRepository), waitingListCalls };
}

describe('HttpDashboardRepository.getSnapshot', () => {
  it('sólo consulta la lista de espera de las sesiones llenas', async () => {
    const { repo, waitingListCalls } = setup([
      session({ id: '10', availableSpots: 0 }),
      session({ id: '11', availableSpots: 2 }),
    ]);
    await repo.getSnapshot('c1');
    expect(waitingListCalls).toEqual(['10']);
  });

  it('si falla la lista de espera, la sesión queda full y el snapshot sobrevive', async () => {
    // La lista de espera es información secundaria; la grilla es la pantalla.
    const { repo } = setup([session({ availableSpots: 0 })], [], {
      waitingList: async () => {
        throw new Error('boom');
      },
    });
    const snap = await repo.getSnapshot('c1');
    expect(snap.grid.sessions[0][0]?.state).toBe('full');
  });

  it('normaliza a DomainError si alguna de las fuentes falla', async () => {
    // El try/catch de getSnapshot envuelve toda la ola: si classSessions.list() (o
    // cualquier otra fuente) rechaza, el snapshot entero falla en vez de mostrarse a
    // medias. toDomainError es idempotente, así que un DomainError ya armado pasa igual.
    const { repo } = setup([], [], {
      list: async () => {
        throw { kind: 'validation', issues: ['boom'] };
      },
    });
    await expect(repo.getSnapshot('c1')).rejects.toMatchObject({ kind: 'validation' });
  });

  it('propaga el clubId recibido', async () => {
    const { repo } = setup();
    const snap = await repo.getSnapshot('c1');
    expect(snap.clubId).toBe('c1');
  });
});
