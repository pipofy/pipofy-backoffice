import { describe, it, expect } from 'vitest';
import { reservationStatusLabel } from './session-reservation';

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
