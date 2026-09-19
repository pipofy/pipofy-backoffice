import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardFacade } from './dashboard.facade';
import { DashboardRepository } from '@domain/contracts/dashboard.repository';
import { ClubRepository } from '@domain/contracts/club.repository';
import { DashboardSnapshot } from '@domain/entities/dashboard-snapshot';

const snapshot: DashboardSnapshot = {
  clubId: 'c1',
  kpis: { sessionsToday: 18, courtsTotal: 24, occupancyPct: 86 },
  grid: { courts: [], hours: [], sessions: [] },
  waitlist: [],
};

function setup(active = true) {
  const dashboards: DashboardRepository = {
    getSnapshot: async () => snapshot,
  };
  // Sólo isActive: es lo único que RefreshDashboard usa (ver refresh-dashboard.use-case.spec.ts).
  const clubs = { isActive: async () => active } as unknown as ClubRepository;
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      DashboardFacade,
      { provide: DashboardRepository, useValue: dashboards },
      { provide: ClubRepository, useValue: clubs },
    ],
  });
  return TestBed.inject(DashboardFacade);
}

describe('DashboardFacade', () => {
  it('carga un snapshot en data()', async () => {
    const f = setup(true);
    await f.load('c1');
    expect(f.data()).toEqual(snapshot);
    expect(f.error()).toBeNull();
  });

  it('captura un DomainError cuando el club está inactivo', async () => {
    const f = setup(false);
    await f.load('c1');
    expect(f.data()).toBeNull();
    expect(f.error()?.kind).toBe('domain'); // ClubInactiveError -> asDomainError -> {kind:'domain'}
  });
});
