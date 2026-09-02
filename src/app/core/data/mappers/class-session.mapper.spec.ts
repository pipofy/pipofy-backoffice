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
        courtId: '2',
        coachId: '5',
        categoryGroupId: '3',
        startAt: '2026-08-19T21:00:00.000Z',
        capacity: 4,
        availableSpots: 1,
      }),
    ).toEqual({
      id: '10',
      courtId: '2',
      coachId: '5',
      categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z',
      capacity: 4,
      availableSpots: 1,
    });
  });

  it('normaliza capacity null a 0', () => {
    // `ClassSession.capacity` es nullable en Prisma. La normalización vive acá y no en cada
    // pantalla para que "cupo" sea siempre un número.
    expect(
      toClassSession({
        id: '10',
        courtId: '2',
        coachId: '5',
        categoryGroupId: '3',
        startAt: null,
        capacity: null,
        availableSpots: 0,
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
      }),
    ).toEqual({
      id: '55',
      studentId: '4',
      studentPlanId: '9',
      holdExpiresAt: null,
      status: 'held',
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
      }).studentPlanId,
    ).toBeNull();
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
