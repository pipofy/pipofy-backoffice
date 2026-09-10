import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { GruposFacade } from './grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { TenantContext } from '@shared/tenant/tenant-context';
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

function setup(
  over: { asistenciaFalla?: boolean; reservasFallan?: boolean; tenant?: unknown } = {},
) {
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

  // TenantContext se inyecta con { optional: true }: sólo lo provee el test que lo mira.
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GruposFacade,
      { provide: GroupsRepository, useValue: groups },
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: CategoriesRepository, useValue: categories },
      { provide: StudentsRepository, useValue: students },
      ...(over.tenant ? [{ provide: TenantContext, useValue: over.tenant }] : []),
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

  // El grupo ya está en pantalla: que falle el roster no debe reemplazarla por el estado de
  // error. Pero tampoco puede pasar por vacío — "Nadie inscripto" debajo de un hero que dice
  // "Inscriptos 3" es la contradicción que el §3.7 existe para evitar, entrando por otra puerta.
  it('si loadDetalle falla, EXPONE el error sin ensuciar el de la pantalla entera', async () => {
    const { facade } = setup({ reservasFallan: true });
    await facade.load();
    await facade.loadDetalle('301');
    expect(facade.detalleError()).not.toBeNull();
    expect(facade.error()).toBeNull();
    expect(facade.loading()).toBe(false);
    expect(facade.detalleCargando()).toBe(false);
    expect(facade.data()).not.toBeNull();
  });

  it('una lectura buena LIMPIA el error de la anterior', async () => {
    const { facade } = setup();
    await facade.loadDetalle('301');
    expect(facade.detalleError()).toBeNull();
  });

  // Un grupo sin próxima sesión es vacío de verdad, no un fallo: el panel dice "Nadie
  // inscripto", no "no pudimos traerlos".
  it('loadDetalle(null) no deja error', async () => {
    const { facade } = setup({ reservasFallan: true });
    await facade.loadDetalle('301');
    await facade.loadDetalle(null);
    expect(facade.detalleError()).toBeNull();
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

  // El guard que evita mostrarle a un club el roster —y el padrón— de otro. El flag del effect
  // saltea el valor INICIAL: sin él, el primer run pisaría el estado recién cargado.
  it('resetea al CAMBIAR de tenant, pero NO en el primer disparo del effect', async () => {
    const tenantId = signal('t1');
    const { facade } = setup({ tenant: { tenantId } });
    await facade.load();
    await facade.loadDetalle('301');
    TestBed.tick();
    expect(facade.data()).not.toBeNull();          // el primer run NO pisó lo recién cargado
    expect(facade.roster()).not.toEqual([]);

    tenantId.set('t2');
    TestBed.tick();
    expect(facade.data()).toBeNull();
    expect(facade.roster()).toEqual([]);
    expect(facade.waitlist()).toEqual([]);
  });

  // Los lookups son un cache privado: si sobrevivieran al cambio, el nombre de categoría de un
  // alumno del club viejo saldría en la tabla del nuevo.
  it('al cambiar de tenant vuelve a pedir categorías y padrón', async () => {
    const tenantId = signal('t1');
    const { facade, calls } = setup({ tenant: { tenantId } });
    await facade.loadDetalle('301');
    TestBed.tick();

    tenantId.set('t2');
    TestBed.tick();
    await facade.loadDetalle('301');
    expect(calls.filter((c) => c === 'categories')).toHaveLength(2);
    expect(calls.filter((c) => c === 'students')).toHaveLength(2);
  });
});
