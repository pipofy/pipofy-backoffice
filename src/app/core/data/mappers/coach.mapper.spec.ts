import { describe, it, expect } from 'vitest';
import { toCoach, toCoachRequest } from './coach.mapper';

describe('toCoach', () => {
  it('arma el nombre con nombre y apellido', () => {
    expect(toCoach({
      id: '5', description: 'Ex profesional',
      user: { nombre: 'Juan', apellido: 'Gómez', email: 'juan@club.com' },
    })).toEqual({ id: '5', displayName: 'Juan Gómez', description: 'Ex profesional' });
  });

  it('con un solo campo cargado no deja espacios sueltos', () => {
    expect(toCoach({
      id: '5', description: null,
      user: { nombre: 'Juan', apellido: null, email: 'juan@club.com' },
    }).displayName).toBe('Juan');
  });

  it('sin nombre cae al email', () => {
    expect(toCoach({
      id: '5', description: null,
      user: { nombre: null, apellido: null, email: 'juan@club.com' },
    }).displayName).toBe('juan@club.com');
  });

  it('sin `user` cae al placeholder con el id', () => {
    // coaches.service.getOne() no incluye `user`, sólo list() lo hace (§3.8).
    expect(toCoach({ id: '5', description: null }).displayName).toBe('Profe #5');
  });

  it('sin nombre ni email cae al placeholder', () => {
    expect(toCoach({
      id: '5', description: null,
      user: { nombre: null, apellido: null, email: null },
    }).displayName).toBe('Profe #5');
  });
});

describe('toCoachRequest', () => {
  it('manda la descripción tal cual', () => {
    expect(toCoachRequest({ description: 'Especialista en revés' }))
      .toEqual({ description: 'Especialista en revés' });
  });

  it('MANDA el null: es lo que vacía la columna (§3.10)', () => {
    expect(toCoachRequest({ description: null })).toEqual({ description: null });
  });
});
