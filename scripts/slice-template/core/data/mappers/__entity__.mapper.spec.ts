import { describe, it, expect } from 'vitest';
import { to__Entity__, to__Entity__Request } from './__entity__.mapper';

describe('to__Entity__', () => {
  it('mapea el DTO a la entidad', () => {
    expect(to__Entity__({ id: '7', name: 'Uno' })).toEqual({ id: '7', name: 'Uno' });
  });

  it('tolera name en null', () => {
    expect(to__Entity__({ id: '8', name: null })).toEqual({ id: '8', name: '' });
  });
});

describe('to__Entity__Request', () => {
  it('manda sólo los campos del DTO', () => {
    expect(to__Entity__Request({ name: 'Uno' })).toEqual({ name: 'Uno' });
  });
});
