import { describe, it, expect } from 'vitest';
import { toCancelClassRequest, toClassSession, toWaitingListEntry, toSessionReservation } from './class-session.mapper';

describe('toClassSession', () => {
  it('mapea la fila tal cual', () => {
    expect(toClassSession({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
    })).toEqual({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
    });
  });

  it('normaliza capacity null a 0', () => {
    // `ClassSession.capacity` es nullable en Prisma. La normalización vive acá y no en cada
    // pantalla para que "cupo" sea siempre un número.
    expect(toClassSession({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: null, capacity: null, availableSpots: 0,
    }).capacity).toBe(0);
  });
});

describe('toWaitingListEntry', () => {
  it('mapea id, alumno y fecha de pedido', () => {
    expect(toWaitingListEntry({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' }))
      .toEqual({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' });
  });
});

describe('toSessionReservation', () => {
  it('aplana reservationStatus.name a status', () => {
    // El backend lo manda embebido (`reservationStatus: { name }`); la entidad no tiene por
    // qué saberlo, así que el mapper lo aplana acá.
    expect(toSessionReservation({
      id: '55', studentId: '4', studentPlanId: '9', holdExpiresAt: null, deletedAt: null,
      reservationStatus: { name: 'held' },
    })).toEqual({
      id: '55', studentId: '4', studentPlanId: '9', holdExpiresAt: null, status: 'held',
    });
  });

  it('studentPlanId null: una reserva cobrada con confirm-payment puede no tener plan', () => {
    expect(toSessionReservation({
      id: '56', studentId: '4', studentPlanId: null, holdExpiresAt: null, deletedAt: null,
      reservationStatus: { name: 'confirmed' },
    }).studentPlanId).toBeNull();
  });
});

describe('toCancelClassRequest', () => {
  it('manda notify y reason cuando hay motivo', () => {
    expect(toCancelClassRequest({ notify: true, reason: 'Se llovió' }))
      .toEqual({ notify: true, reason: 'Se llovió' });
  });

  it('OMITE reason cuando es null, no lo manda vacío', () => {
    // Con el ValidationPipe en whitelist, la clave en null es un 400 y no "sin motivo".
    expect('reason' in toCancelClassRequest({ notify: false, reason: null })).toBe(false);
  });
});
