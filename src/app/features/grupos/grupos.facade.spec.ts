import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GruposFacade } from './grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Group } from '@domain/entities/group';
import { SessionReservation } from '@domain/entities/session-reservation';

const grupo = (over: Partial<Group> = {}): Group => ({
  id: '7', category: '7ma+8va', teacher: 'Diego A.', courtName: 'Cancha 1',
  weekday: 1, startTime: '18:00', capacity: 4, enrolled: 3, waiting: 1,
  nextSessionId: '301', sessions: [], ...over,
});

const reserva = (over: Partial<SessionReservation> = {}): SessionReservation => ({
  id: '500', studentId: '88', studentPlanId: null, status: 'confirmed',
  holdExpiresAt: null, attendanceStatus: null, studentName: 'Lucía Pereyra',
  studentCategoryId: '3', ...over,
});

function setup(over: { asistenciaFalla?: boolean; reservasFallan?: boolean } = {}) {
  const calls: string[] = [];

  const groups = {
    listGroups: async () => { calls.push('listGroups'); return [grupo()]; },
  } as unknown as GroupsRepository;

  const sessions = {
    reservations: async (id: string) => {
      calls.push(`reservations:${id}`);
      if (over.reservasFallan) throw new Error('boom');
      return [reserva()];
    },
    waitingList: async (id: string) => { calls.push(`waitingList:${id}`); return []; },
    markAttendance: async (id: string) => {
      calls.push(`markAttendance:${id}`);
      if (over.asistenciaFalla) throw new Error('boom');
      return [{ reservationId: '500', ok: true, status: 'asistio' as const, error: null }];
    },
  } as unknown as ClassSessionsRepository;

  const categories = {
    list: async () => { calls.push('categories'); return [{ id: '3', name: '7ma', levelOrder: 7 }]; },
  } as unknown as CategoriesRepository;
  const students = {
    list: async () => { calls.push('students'); return []; },
  } as unknown as StudentsRepository;

  // TenantContext se inyecta con { optional: true }: no hace falta proveerlo.
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GruposFacade,
      { provide: GroupsRepository, useValue: groups },
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: CategoriesRepository, useValue: categories },
      { provide: StudentsRepository, useValue: students },
    ],
  });
  return { facade: TestBed.inject(GruposFacade), calls };
}

describe('GruposFacade', () => {
  it('load() llena groups()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.groups().map((g) => g.id)).toEqual(['7']);
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('loadDetalle() trae roster y lista de espera de esa sesión', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle('301');
    expect(calls).toContain('reservations:301');
    expect(calls).toContain('waitingList:301');
    expect(facade.roster().map((m) => m.id)).toEqual(['500']);
    expect(facade.detalleCargando()).toBe(false);
  });

  // Un grupo sin próxima sesión programada no tiene roster que pedir.
  it('loadDetalle(null) vacía las listas sin pegarle a nadie', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle(null);
    expect(facade.roster()).toEqual([]);
    expect(facade.waitlist()).toEqual([]);
    expect(calls).toEqual([]);
  });

  // El grupo ya está en pantalla: que falle el roster no debe reemplazarla por el estado de error.
  it('si loadDetalle falla, no ensucia error() ni loading()', async () => {
    const { facade } = setup({ reservasFallan: true });
    await facade.load();
    await facade.loadDetalle('301');
    expect(facade.error()).toBeNull();
    expect(facade.loading()).toBe(false);
    expect(facade.roster()).toEqual([]);
    expect(facade.data()).not.toBeNull();
  });

  it('pide categorías y padrón UNA sola vez aunque se llame dos veces', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle('301');
    await facade.loadDetalle('301');
    expect(calls.filter((c) => c === 'categories')).toHaveLength(1);
    expect(calls.filter((c) => c === 'students')).toHaveLength(1);
  });

  // LAS DOS TRAMPAS GEMELAS. El modal vive DENTRO de la rama data() del template: si esto
  // prendiera loading() o setError(), se desmontaría con el usuario adentro. Y si no propagara,
  // el catch de la página no correría y saldría el toast de ÉXITO tras un fallo.
  it('saveAttendance no toca loading() ni error(), y PROPAGA el fallo', async () => {
    const { facade } = setup({ asistenciaFalla: true });
    await facade.load();
    await expect(
      facade.saveAttendance('301', [{ reservationId: '500', status: 'asistio' }]),
    ).rejects.toBeDefined();
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.data()).not.toBeNull();
  });

  it('saveAttendance devuelve el resultado POR ÍTEM y no relee', async () => {
    const { facade, calls } = setup();
    const results = await facade.saveAttendance('301', [{ reservationId: '500', status: 'asistio' }]);
    expect(results).toEqual([{ reservationId: '500', ok: true, status: 'asistio', error: null }]);
    // markBulk no toca cupo, créditos ni estados: no hay nada que releer.
    expect(calls).toEqual(['markAttendance:301']);
  });

  // createSessionAttendanceDraft valida las dos invariantes que el backend valida a nivel DTO.
  it('rechaza guardar sin ninguna marca, antes de pegarle al backend', async () => {
    const { facade, calls } = setup();
    await expect(facade.saveAttendance('301', [])).rejects.toBeDefined();
    expect(calls).toEqual([]);
  });
});
