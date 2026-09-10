import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
  toCancelClassRequest,
  toClassSession,
  toWaitingListEntry,
  toSessionReservation,
  toAttendanceRequest,
  toSessionAttendanceResult,
} from './class-session.mapper';
import { AttendanceResultListDtoSchema } from '../dto/class-session.dto';

describe('toClassSession', () => {
  it('mapea la fila tal cual', () => {
    expect(
      toClassSession({
        id: '10',
        scheduleTemplateId: '7',
        courtId: '2',
        coachId: '5',
        categoryGroupId: '3',
        startAt: '2026-08-19T21:00:00.000Z',
        capacity: 4,
        availableSpots: 1,
        waitingCount: 3,
        classSessionStatus: { id: '2', name: 'cancelada' },
      }),
    ).toEqual({
      id: '10',
      scheduleTemplateId: '7',
      courtId: '2',
      coachId: '5',
      categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z',
      capacity: 4,
      availableSpots: 1,
      waitingCount: 3,
      // El embebido se aplana a su nombre: la entidad no sabe que viene anidado.
      status: 'cancelada',
    });
  });

  it('normaliza capacity null a 0', () => {
    // `ClassSession.capacity` es nullable en Prisma. La normalización vive acá y no en cada
    // pantalla para que "cupo" sea siempre un número.
    expect(
      toClassSession({
        id: '10',
        scheduleTemplateId: null,
        courtId: '2',
        coachId: '5',
        categoryGroupId: '3',
        startAt: null,
        capacity: null,
        availableSpots: 0,
        waitingCount: 0,
        classSessionStatus: { id: '1', name: 'programada' },
      }).capacity,
    ).toBe(0);
  });
});

describe('toWaitingListEntry', () => {
  it('mapea id, alumno y fecha de pedido', () => {
    expect(
      toWaitingListEntry({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' }),
    ).toEqual({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' });
  });
});

describe('toSessionReservation', () => {
  it('aplana reservationStatus.name a status', () => {
    // El backend lo manda embebido (`reservationStatus: { name }`); la entidad no tiene por
    // qué saberlo, así que el mapper lo aplana acá.
    expect(
      toSessionReservation({
        id: '55',
        studentId: '4',
        studentPlanId: '9',
        holdExpiresAt: null,
        deletedAt: null,
        reservationStatus: { name: 'held' },
        attendanceStatus: { id: '14', name: 'asistio' },
        student: { firstName: 'Ana', lastName: 'Gómez', categoryId: null },
      }),
    ).toEqual({
      id: '55',
      studentId: '4',
      studentPlanId: '9',
      holdExpiresAt: null,
      status: 'held',
      attendanceStatus: 'asistio',
      studentName: 'Ana Gómez',
      studentCategoryId: null,
    });
  });

  it('studentPlanId null: una reserva cobrada con confirm-payment puede no tener plan', () => {
    expect(
      toSessionReservation({
        id: '56',
        studentId: '4',
        studentPlanId: null,
        holdExpiresAt: null,
        deletedAt: null,
        reservationStatus: { name: 'confirmed' },
        attendanceStatus: null,
        student: { firstName: 'Ana', lastName: 'Gómez', categoryId: null },
      }).studentPlanId,
    ).toBeNull();
  });
});

describe('toSessionReservation · student embebido', () => {
  const base = {
    id: '500',
    studentId: '88',
    studentPlanId: null,
    holdExpiresAt: null,
    deletedAt: null,
    reservationStatus: { name: 'confirmed' },
    attendanceStatus: null,
  };

  it('arma el nombre completo y trae la categoría del alumno', () => {
    const r = toSessionReservation({
      ...base,
      student: { firstName: 'Lucía', lastName: 'Pereyra', categoryId: '3' },
    });
    expect(r.studentName).toBe('Lucía Pereyra');
    expect(r.studentCategoryId).toBe('3');
  });

  // firstName y lastName son String? en Prisma: hay filas cargadas por WhatsApp con sólo el
  // teléfono. El nombre queda vacío y lo resuelve la pantalla, no el mapper.
  it('tolera nombre y apellido nulos sin dejar espacios sueltos', () => {
    const r = toSessionReservation({
      ...base,
      student: { firstName: null, lastName: 'Vera', categoryId: null },
    });
    expect(r.studentName).toBe('Vera');
    expect(r.studentCategoryId).toBeNull();
  });
});

describe('toCancelClassRequest', () => {
  it('manda notify y reason cuando hay motivo', () => {
    expect(toCancelClassRequest({ notify: true, reason: 'Se llovió' })).toEqual({
      notify: true,
      reason: 'Se llovió',
    });
  });

  it('OMITE reason cuando es null, no lo manda vacío', () => {
    // Con el ValidationPipe en whitelist, la clave en null es un 400 y no "sin motivo".
    expect('reason' in toCancelClassRequest({ notify: false, reason: null })).toBe(false);
  });
});

describe('toAttendanceRequest', () => {
  it('arma el body con la forma EXACTA que acepta el DTO del backend', () => {
    // forbidNonWhitelisted: true es global (app.module.ts): una clave de más es un 400 de la
    // llamada entera, no un campo ignorado.
    expect(
      toAttendanceRequest([
        { reservationId: '55', status: 'asistio' },
        { reservationId: '56', status: 'ausente' },
      ]),
    ).toEqual({
      items: [
        { reservationId: '55', status: 'asistio' },
        { reservationId: '56', status: 'ausente' },
      ],
    });
  });
});

describe('toSessionAttendanceResult', () => {
  it('un ítem que salió bien viene SIN `error`', () => {
    expect(toSessionAttendanceResult({ reservationId: '55', ok: true, status: 'asistio' })).toEqual(
      { reservationId: '55', ok: true, status: 'asistio', error: null },
    );
  });

  it('un ítem que falló viene SIN `status`', () => {
    expect(
      toSessionAttendanceResult({
        reservationId: '56',
        ok: false,
        error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
      }),
    ).toEqual({
      reservationId: '56',
      ok: false,
      status: null,
      error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
    });
  });

  it('un status que este panel no conoce queda en null y no se cuela al union', () => {
    // La tabla attendance_status tiene CINCO nombres sembrados. WhatsApp escribe
    // confirmo_si/confirmo_no/sin_respuesta sobre la misma fila que el panel. Un cast a ciegas
    // metería uno de ésos en un tipo que dice que no puede estar.
    expect(
      toSessionAttendanceResult({ reservationId: '57', ok: true, status: 'confirmo_si' }).status,
    ).toBeNull();
  });
});

describe('AttendanceResultListDtoSchema', () => {
  it('tolera el array MIXTO que devuelve el backend', () => {
    // markBulk hace push de dos formas distintas según el desenlace de cada ítem: nunca manda
    // las dos claves juntas, así que las dos tienen que ser opcionales.
    const crudo = [
      { reservationId: '55', ok: true, status: 'asistio' },
      { reservationId: '56', ok: false, error: 'La reserva no pertenece a esta clase' },
    ];
    expect(() => v.parse(AttendanceResultListDtoSchema, crudo)).not.toThrow();
  });
});
