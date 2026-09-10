import { describe, it, expect } from 'vitest';
import { GroupNotFoundError, DomainRuleError } from './errors';

describe('errores de Grupos', () => {
  // Extender DomainRuleError es lo que hace que estos errores lleguen al usuario con SU mensaje
  // en vez de "Ocurrió un error inesperado": toDomainError los normaliza a { kind: 'domain' } por
  // instanceof. Esa normalización es genérica y vive en data/ — la cubre to-domain-error.spec.ts.
  // Acá, en domain (que no puede importar de data), se fija lo que es de domain: la herencia y el copy.
  it('extiende DomainRuleError y lleva su mensaje', () => {
    const err = new GroupNotFoundError('7');
    expect(err).toBeInstanceOf(DomainRuleError);
    expect(err.message).toBe('No existe el grupo 7.');
  });
});
