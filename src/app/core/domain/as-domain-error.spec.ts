import { describe, it, expect } from 'vitest';
import { asDomainError, InvalidCourtError } from './errors';

describe('asDomainError', () => {
  it('un DomainError ya normalizado pasa sin cambios', () => {
    const err = { kind: 'forbidden' as const };
    expect(asDomainError(err)).toBe(err);
  });

  it('una DomainRuleError sale como kind domain con su mensaje', () => {
    expect(asDomainError(new InvalidCourtError('El nombre es obligatorio.'))).toEqual({
      kind: 'domain',
      message: 'El nombre es obligatorio.',
    });
  });

  it('cualquier otra cosa sale como unknown con la causa', () => {
    const boom = new Error('boom');
    expect(asDomainError(boom)).toEqual({ kind: 'unknown', cause: boom });
  });
});
