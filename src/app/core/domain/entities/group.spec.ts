import { describe, it, expect } from 'vitest';
import { GroupSession, puedeTomarAsistencia } from './group';

const sesion = (over: Partial<GroupSession> = {}): GroupSession => ({
  id: '301',
  startAt: '2026-09-01T21:00:00.000Z',
  courtName: 'Cancha 1',
  status: 'programada',
  enrolled: 4,
  capacity: 4,
  waiting: 0,
  yaPaso: true,
  ...over,
});

describe('puedeTomarAsistencia', () => {
  it('sí sobre una sesión que ya pasó', () => {
    expect(puedeTomarAsistencia(sesion())).toBe(true);
  });

  it('no sobre una futura', () => {
    expect(puedeTomarAsistencia(sesion({ yaPaso: false }))).toBe(false);
  });

  // El backend no la bloquea —markBulk sólo mira que la reserva esté confirmed— pero tomar
  // asistencia de una clase que se canceló no significa nada.
  it('no sobre una cancelada, aunque ya haya pasado', () => {
    expect(puedeTomarAsistencia(sesion({ status: 'cancelada' }))).toBe(false);
  });
});
