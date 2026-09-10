import { describe, it, expect } from 'vitest';
import {
  asistenciaTomada,
  reservationStatusLabel,
  SessionReservation,
} from './session-reservation';

describe('reservationStatusLabel', () => {
  it('traduce los siete estados sembrados por el backend', () => {
    // prisma/seed.ts:14 — si el seed suma uno nuevo, cae al humanizador y se ve aceptable.
    expect(reservationStatusLabel('held')).toBe('Sin confirmar');
    expect(reservationStatusLabel('confirmed')).toBe('Confirmada');
    expect(reservationStatusLabel('pending_review')).toBe('En revisión');
    expect(reservationStatusLabel('expired')).toBe('Vencida');
    expect(reservationStatusLabel('cancelled')).toBe('Cancelada');
    expect(reservationStatusLabel('completed')).toBe('Completada');
    expect(reservationStatusLabel('no_show')).toBe('Ausente');
  });

  it('humaniza un estado desconocido en vez de romper', () => {
    expect(reservationStatusLabel('algo_nuevo')).toBe('Algo nuevo');
  });

  it('no devuelve miembros heredados de Object.prototype', () => {
    // Mismo bug que documenta catalog-labels.ts: con un Record, CATALOG_LABELS['constructor']
    // devuelve la función Object y el ?? nunca se dispara. TypeScript lo tipa como string igual.
    expect(reservationStatusLabel('constructor')).toBe('Constructor');
  });
});

describe('asistenciaTomada', () => {
  const con = (attendanceStatus: string | null): SessionReservation => ({
    id: '55',
    studentId: '4',
    studentPlanId: null,
    status: 'confirmed',
    holdExpiresAt: null,
    attendanceStatus,
  });

  it('devuelve los dos estados que el panel escribe', () => {
    expect(asistenciaTomada(con('asistio'))).toBe('asistio');
    expect(asistenciaTomada(con('ausente'))).toBe('ausente');
  });

  it('los tres estados de WhatsApp caen a null: no son asistencia tomada', () => {
    // 'confirmo_si' es el alumno diciendo que va a ir, no el profe diciendo que fue.
    expect(asistenciaTomada(con('confirmo_si'))).toBeNull();
    expect(asistenciaTomada(con('confirmo_no'))).toBeNull();
    expect(asistenciaTomada(con('sin_respuesta'))).toBeNull();
  });

  it('null cuando nadie marcó nada, y también ante un valor nuevo del seed', () => {
    expect(asistenciaTomada(con(null))).toBeNull();
    expect(asistenciaTomada(con('algo_nuevo'))).toBeNull();
  });
});
