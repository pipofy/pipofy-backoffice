import { describe, it, expect } from 'vitest';
import { createSessionAttendanceDraft, SessionAttendanceMark } from './session-attendance';
import { InvalidAttendanceError } from '../errors';

const marca = (n: number): SessionAttendanceMark => ({
  reservationId: String(n),
  status: 'asistio',
});

describe('createSessionAttendanceDraft', () => {
  it('sin marcas tira: el backend valida @ArrayMinSize(1) y responde 400', () => {
    expect(() => createSessionAttendanceDraft([])).toThrow(InvalidAttendanceError);
  });

  it('con más de 100 tira: es el tope de @ArrayMaxSize(100) del DTO del backend', () => {
    const ciento_una = Array.from({ length: 101 }, (_, i) => marca(i));
    expect(() => createSessionAttendanceDraft(ciento_una)).toThrow(InvalidAttendanceError);
  });

  it('con exactamente 100 pasa: el tope es inclusivo', () => {
    const cien = Array.from({ length: 100 }, (_, i) => marca(i));
    expect(createSessionAttendanceDraft(cien)).toHaveLength(100);
  });

  it('devuelve las marcas tal cual: no reordena, no deduplica, no completa nada', () => {
    // Lo que llega ya viene reconciliado contra el roster por el componente. El draft valida
    // las invariantes de escritura y nada más.
    const marcas: SessionAttendanceMark[] = [
      { reservationId: '7', status: 'ausente' },
      { reservationId: '3', status: 'asistio' },
    ];
    expect(createSessionAttendanceDraft(marcas)).toEqual(marcas);
  });
});
