import { describe, it, expect } from 'vitest';
import { toPlan, toPlanRequest } from './plan.mapper';
import { PlanDraft } from '@domain/entities/plan';

const dto = {
  id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: 8, price: '12000.5', validityDays: 30, active: true,
};

const draft: PlanDraft = {
  name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: 8, price: '12000.5', validityDays: 30, active: true,
};

describe('toPlan', () => {
  it('mapea el DTO a la entidad', () => {
    expect(toPlan(dto)).toEqual({
      id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5',
      classCount: 8, price: '12000.5', validityDays: 30, active: true,
    });
  });

  it('el nombre null se tolera como cadena vacía', () => {
    expect(toPlan({ ...dto, name: null }).name).toBe('');
  });

  it('normaliza el precio a string aunque llegue como número', () => {
    // Prisma serializa Decimal vía decimal.js (string), pero no se pudo verificar con el
    // server levantado (§3.5). El DTO acepta las dos formas y el mapper las unifica.
    expect(toPlan({ ...dto, price: 12000.5 }).price).toBe('12000.5');
    expect(typeof toPlan({ ...dto, price: 12000.5 }).price).toBe('string');
  });

  it('el precio null queda null, no "null"', () => {
    expect(toPlan({ ...dto, price: null }).price).toBeNull();
  });
});

describe('toPlanRequest', () => {
  it('OMITE coachId cuando es null', () => {
    // plans.service.validateReferences() hace BigInt(dto.coachId) apenas la clave está
    // presente, y BigInt(null) tira TypeError → 500 (§3.2). Verificado con node.
    const body = toPlanRequest({ ...draft, coachId: null });
    expect('coachId' in body).toBe(false);
  });

  it('manda coachId cuando lo hay', () => {
    expect(toPlanRequest(draft).coachId).toBe('5');
  });

  it('SÍ manda null en los opcionales que se pueden vaciar', () => {
    // @IsOptional() saltea la validación cuando el valor es null, así que el null llega a
    // Prisma y borra el campo. Omitirlos daría `undefined`, que en Prisma significa "no
    // toques este campo": el valor viejo sobreviviría en silencio (§3.3).
    const body = toPlanRequest({ ...draft, classCount: null, price: null, validityDays: null });
    expect('classCount' in body).toBe(true);
    expect(body.classCount).toBeNull();
    expect('price' in body).toBe(true);
    expect(body.price).toBeNull();
    expect('validityDays' in body).toBe(true);
    expect(body.validityDays).toBeNull();
  });

  it('manda exactamente las claves del DTO del backend', () => {
    // forbidNonWhitelisted: true → cualquier clave de más devuelve 400.
    expect(Object.keys(toPlanRequest(draft)).sort())
      .toEqual(['active', 'classCount', 'coachId', 'name', 'planTypeId', 'price', 'validityDays']);
  });
});
