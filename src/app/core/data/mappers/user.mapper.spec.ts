import { describe, it, expect } from 'vitest';
import { toCreateUserRequest } from './user.mapper';

describe('toCreateUserRequest', () => {
  it('manda email y roleId', () => {
    expect(toCreateUserRequest({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' }))
      .toEqual({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' });
  });

  it('OMITE nombre y apellido cuando son null, no los manda en null', () => {
    const body = toCreateUserRequest({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' });
    expect('nombre' in body).toBe(false);
    expect('apellido' in body).toBe(false);
    expect(body).toEqual({ email: 'a@b.com', roleId: '7' });
  });

  it('nunca manda clubId: el backend lo saca del JWT', () => {
    // Mandarlo activaría la comparación de ClubScopeGuard, que hoy pasa de largo justamente
    // porque el body no lo lleva (§4.2).
    expect('clubId' in toCreateUserRequest({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' }))
      .toBe(false);
  });
});
