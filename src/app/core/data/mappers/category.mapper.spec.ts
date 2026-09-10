import { describe, it, expect } from 'vitest';
import { toCategory, toCategoryRequest } from './category.mapper';

describe('toCategory', () => {
  it('mapea el DTO a la entidad', () => {
    expect(toCategory({ id: '2', name: '4ta', levelOrder: 4 }))
      .toEqual({ id: '2', name: '4ta', levelOrder: 4 });
  });

  it('tolera los nulls que el backend permite guardar', () => {
    expect(toCategory({ id: '3', name: null, levelOrder: null }))
      .toEqual({ id: '3', name: '', levelOrder: null });
  });
});

describe('toCategoryRequest', () => {
  it('manda levelOrder cuando tiene valor', () => {
    expect(toCategoryRequest({ name: '4ta', levelOrder: 4 }))
      .toEqual({ name: '4ta', levelOrder: 4 });
  });

  it('manda levelOrder en null — NO lo omite', () => {
    // El reverso exacto del test de canchas, y a propósito: acá el null es seguro
    // (no pasa por BigInt) y es necesario, porque omitir la clave le da `undefined` a
    // Prisma, que significa "no toques el campo": el orden viejo sobreviviría al borrado.
    const body = toCategoryRequest({ name: 'Iniciación', levelOrder: null });
    expect('levelOrder' in body).toBe(true);
    expect(body.levelOrder).toBeNull();
  });
});
