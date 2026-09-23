import { describe, it, expect } from 'vitest';
import { create__Entity__Draft } from './__entity__';
import { Invalid__Entity__Error } from '../errors';

describe('create__Entity__Draft', () => {
  it('recorta el nombre', () => {
    expect(create__Entity__Draft({ name: '  Uno  ' })).toEqual({ name: 'Uno' });
  });

  it('tira Invalid__Entity__Error cuando el nombre está vacío', () => {
    expect(() => create__Entity__Draft({ name: '   ' })).toThrow(Invalid__Entity__Error);
  });
});
