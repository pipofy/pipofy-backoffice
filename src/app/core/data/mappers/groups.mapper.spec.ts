import { describe, it, expect } from 'vitest';
import { toGroups, toRoster, toGroupWaitlist, GroupsInput } from './groups.mapper';
import { Schedule } from '@domain/entities/schedule';
import { ClassSession } from '@domain/entities/class-session';
import { SessionReservation } from '@domain/entities/session-reservation';

const AHORA = new Date('2026-09-10T12:00:00.000Z');

const template = (over: Partial<Schedule> = {}): Schedule => ({
  id: '7',
  courtId: '1',
  coachId: '3',
  categoryGroupId: '2',
  sessionTypeId: '1',
  weekday: 1,
  startTime: '18:00',
  endTime: '19:30',
  capacity: 4,
  price: null,
  active: true,
  validFrom: null,
  validTo: null,
  ...over,
});

const sesion = (over: Partial<ClassSession> = {}): ClassSession => ({
  id: '301',
  scheduleTemplateId: '7',
  courtId: '1',
  coachId: '3',
  categoryGroupId: '2',
  startAt: '2026-09-14T21:00:00.000Z',
  capacity: 4,
  availableSpots: 1,
  waitingCount: 2,
  status: 'programada',
  ...over,
});

const input = (over: Partial<GroupsInput> = {}): GroupsInput => ({
  schedules: [template()],
  sessions: [sesion()],
  courts: [
    { id: '1', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null },
  ],
  coaches: [{ id: '3', displayName: 'Diego A.', description: null }],
  categoryGroups: [{ id: '2', name: '7ma+8va' }],
  ...over,
});

describe('toGroups', () => {
  it('arma el grupo desde el template y resuelve los nombres', () => {
    const [g] = toGroups(input(), AHORA);
    expect(g.id).toBe('7');
    expect(g.category).toBe('7ma+8va');
    expect(g.teacher).toBe('Diego A.');
    expect(g.courtName).toBe('Cancha 1');
    expect(g.weekday).toBe(1);
    expect(g.startTime).toBe('18:00');
    expect(g.capacity).toBe(4);
  });

  it('toma enrolled, waiting y nextSessionId de la próxima sesión PROGRAMADA', () => {
    const [g] = toGroups(
      input({
        sessions: [
          sesion({ id: 'pasada', startAt: '2026-09-07T21:00:00.000Z', availableSpots: 4, waitingCount: 0 }),
          sesion({ id: 'cancelada', startAt: '2026-09-14T21:00:00.000Z', status: 'cancelada', availableSpots: 4 }),
          sesion({ id: 'proxima', startAt: '2026-09-21T21:00:00.000Z', availableSpots: 1, waitingCount: 2 }),
          sesion({ id: 'lejana', startAt: '2026-09-28T21:00:00.000Z', availableSpots: 0, waitingCount: 9 }),
        ],
      }),
      AHORA,
    );
    expect(g.nextSessionId).toBe('proxima');
    expect(g.enrolled).toBe(3);   // capacity 4 − availableSpots 1
    expect(g.waiting).toBe(2);
  });

  it('ordena las sesiones ascendente y marca yaPaso contra el reloj recibido', () => {
    const [g] = toGroups(
      input({
        sessions: [
          sesion({ id: 'b', startAt: '2026-09-14T21:00:00.000Z' }),
          sesion({ id: 'a', startAt: '2026-09-07T21:00:00.000Z' }),
        ],
      }),
      AHORA,
    );
    expect(g.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(g.sessions.map((s) => s.yaPaso)).toEqual([true, false]);
  });

  // Una clase creada a mano no cuelga de ninguna plantilla: no es de ningún grupo.
  it('ignora las sesiones sin scheduleTemplateId', () => {
    const [g] = toGroups(input({ sessions: [sesion({ scheduleTemplateId: null })] }), AHORA);
    expect(g.sessions).toEqual([]);
    expect(g.nextSessionId).toBeNull();
    expect(g.enrolled).toBe(0);
    expect(g.waiting).toBe(0);
  });

  // Los inactivos no generan sesiones (generateSessions filtra active: true), así que un grupo
  // inactivo es un grupo que no existe más.
  it('descarta los templates inactivos', () => {
    expect(toGroups(input({ schedules: [template({ active: false })] }), AHORA)).toEqual([]);
  });

  it('muestra el template aunque no tenga sesiones en la ventana', () => {
    const [g] = toGroups(input({ sessions: [] }), AHORA);
    expect(g.sessions).toEqual([]);
    expect(g.enrolled).toBe(0);
  });

  it('cae a guión cuando un id no matchea ningún lookup', () => {
    const [g] = toGroups(input({ courts: [], coaches: [], categoryGroups: [] }), AHORA);
    expect([g.courtName, g.teacher, g.category]).toEqual(['—', '—', '—']);
  });
});

describe('toRoster', () => {
  const reserva = (over: Partial<SessionReservation> = {}): SessionReservation => ({
    id: '500',
    studentId: '88',
    studentPlanId: null,
    status: 'confirmed',
    holdExpiresAt: null,
    attendanceStatus: null,
    studentName: 'Lucía Pereyra',
    studentCategoryId: '3',
    ...over,
  });
  const categorias = [{ id: '3', name: '7ma', levelOrder: 7 }];

  it('usa la reserva como id de la fila y resuelve la categoría', () => {
    const [m] = toRoster([reserva()], categorias, AHORA);
    expect(m.id).toBe('500');
    expect(m.studentId).toBe('88');
    expect(m.name).toBe('Lucía Pereyra');
    expect(m.category).toBe('7ma');
  });

  // La MISMA definición de "lugar ocupado" que usa el backend (occupiedSpotsWhere), para que el
  // largo de esta tabla coincida con el `enrolled` del cupo.
  it('deja pasar confirmed y held vigente, y descarta el resto', () => {
    const rows = toRoster(
      [
        reserva({ id: 'conf', status: 'confirmed' }),
        reserva({ id: 'vigente', status: 'held', holdExpiresAt: '2026-09-10T13:00:00.000Z' }),
        reserva({ id: 'vencido', status: 'held', holdExpiresAt: '2026-09-10T11:00:00.000Z' }),
        reserva({ id: 'sinvto', status: 'held', holdExpiresAt: null }),
        reserva({ id: 'cancelada', status: 'cancelled' }),
      ],
      categorias,
      AHORA,
    );
    expect(rows.map((r) => r.id)).toEqual(['conf', 'vigente']);
  });

  it('cae a guión sin categoría o con una que no está en el catálogo', () => {
    const rows = toRoster(
      [reserva({ id: 'a', studentCategoryId: null }), reserva({ id: 'b', studentCategoryId: '99' })],
      categorias,
      AHORA,
    );
    expect(rows.map((r) => r.category)).toEqual(['—', '—']);
  });

  it('cae a guión con el alumno sin nombre cargado', () => {
    const [m] = toRoster([reserva({ studentName: '' })], categorias, AHORA);
    expect(m.name).toBe('—');
  });
});

describe('toGroupWaitlist', () => {
  const alumno = {
    id: '91',
    phone: '+5491100000000',
    firstName: 'Julián',
    lastName: 'Vera',
    birthDate: null,
    categoryId: null,
    studentStatusId: '1',
    dominantHand: null,
    ranking: null,
    notes: null,
  };

  it('resuelve el nombre contra el padrón', () => {
    const [e] = toGroupWaitlist(
      [{ id: '7', studentId: '91', requestedAt: '2026-09-01T12:00:00.000Z' }],
      [alumno],
    );
    expect(e).toEqual({
      id: '7',
      studentId: '91',
      name: 'Julián Vera',
      requestedAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('cae a guión si el alumno no está en el padrón', () => {
    const [e] = toGroupWaitlist([{ id: '7', studentId: '404', requestedAt: null }], [alumno]);
    expect(e.name).toBe('—');
  });
});
