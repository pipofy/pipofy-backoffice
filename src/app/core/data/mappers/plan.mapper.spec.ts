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
  it('OMITE coachId null en el ALTA', () => {
    // plans.service.create sí pasa por fkOpcional() y aguantaría el null (verificado contra
    // el server: POST con coachId:null devuelve 201). Se omite igual para que los tres
    // mappers tengan UNA sola regla: en el alta, un FK vacío es una clave ausente.
    expect('coachId' in toPlanRequest({ ...draft, coachId: null }, 'alta')).toBe(false);
  });

  it('MANDA coachId en null al EDITAR: es la única forma de vaciarlo', () => {
    // Omitirlo le daría a Prisma `undefined`, o sea "no toques este campo", y el profesor
    // viejo sobreviviría en silencio (§3.3).
    const body = toPlanRequest({ ...draft, coachId: null }, 'edicion');
    expect('coachId' in body).toBe(true);
    expect(body.coachId).toBeNull();
  });

  it('manda coachId cuando lo hay', () => {
    expect(toPlanRequest(draft, 'alta').coachId).toBe('5');
    expect(toPlanRequest(draft, 'edicion').coachId).toBe('5');
  });

  it('SÍ manda null en los opcionales que se pueden vaciar', () => {
    // @IsOptional() saltea la validación cuando el valor es null, así que el null llega a
    // Prisma y borra el campo. Omitirlos daría `undefined`, que en Prisma significa "no
    // toques este campo": el valor viejo sobreviviría en silencio (§3.3).
    const body = toPlanRequest({ ...draft, classCount: null, price: null, validityDays: null }, 'edicion');
    expect('classCount' in body).toBe(true);
    expect(body.classCount).toBeNull();
    expect('price' in body).toBe(true);
    expect(body.price).toBeNull();
    expect('validityDays' in body).toBe(true);
    expect(body.validityDays).toBeNull();
  });

  it('manda exactamente las claves del DTO del backend', () => {
    // forbidNonWhitelisted: true → cualquier clave de más devuelve 400.
    const claves = ['active', 'classCount', 'coachId', 'name', 'planTypeId', 'price', 'validityDays'];
    expect(Object.keys(toPlanRequest(draft, 'alta')).sort()).toEqual(claves);
    expect(Object.keys(toPlanRequest(draft, 'edicion')).sort()).toEqual(claves);
  });
});
