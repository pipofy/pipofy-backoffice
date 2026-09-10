import { describe, it, expect } from 'vitest';
import { toCategoryGroup, toCategoryGroupRequest } from './category-group.mapper';

describe('toCategoryGroup', () => {
  it('mapea el DTO a la entidad', () => {
    expect(toCategoryGroup({ id: '3', name: 'Principiantes' }))
      .toEqual({ id: '3', name: 'Principiantes' });
  });

  it('el nombre null se tolera como cadena vacía', () => {
    // El backend acepta grupos sin nombre; la lista tiene que poder mostrarlos.
    expect(toCategoryGroup({ id: '3', name: null }).name).toBe('');
  });
});

describe('toCategoryGroupRequest', () => {
  it('manda sólo `name`', () => {
    // forbidNonWhitelisted: true → cualquier clave de más devuelve 400.
    const body = toCategoryGroupRequest({ name: 'Avanzados' });
    expect(Object.keys(body)).toEqual(['name']);
  });
});
