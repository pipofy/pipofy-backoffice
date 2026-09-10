import { describe, it, expect } from 'vitest';
import { toCourt, toCourtRequest } from './court.mapper';

describe('toCourt', () => {
  it('mapea el DTO a la entidad', () => {
    expect(toCourt({
      id: '7', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3',
      indoor: true, courtStatusId: '1',
    })).toEqual({
      id: '7', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
    });
  });

  it('tolera los nulls que el backend permite guardar', () => {
    // POST /courts con {} devuelve 201 (§4.6): estas filas existen y la lista debe mostrarlas.
    expect(toCourt({
      id: '8', name: null, code: null, surfaceTypeId: null,
      indoor: null, courtStatusId: null,
    })).toEqual({
      id: '8', name: '', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null,
    });
  });
});

describe('toCourtRequest', () => {
  it('manda los FK cuando tienen valor', () => {
    expect(toCourtRequest({
      name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
    })).toEqual({
      name: 'Cancha 1', code: 'C1', indoor: true, surfaceTypeId: '3', courtStatusId: '1',
    });
  });

  it('OMITE los FK cuando son null en vez de mandarlos', () => {
    // EL test de esta tarea. courts.service hace
    //   dto.surfaceTypeId !== undefined ? BigInt(dto.surfaceTypeId) : undefined
    // y BigInt(null) tira TypeError, o sea 500. Mandar la clave en null rompe el servidor.
    const body = toCourtRequest({
      name: 'Cancha 2', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null,
    });
    expect('surfaceTypeId' in body).toBe(false);
    expect('courtStatusId' in body).toBe(false);
  });

  it('SÍ manda code en null, que es la única forma de limpiarlo', () => {
    const body = toCourtRequest({
      name: 'Cancha 2', code: null, surfaceTypeId: '3', indoor: false, courtStatusId: '1',
    });
    expect(body.code).toBeNull();
  });
});
