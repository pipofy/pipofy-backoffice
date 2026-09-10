import { describe, it, expect } from 'vitest';
import { WEEKDAY_OPTIONS, weekdayLabel } from './weekday-label';

describe('weekdayLabel', () => {
  it('0 es DOMINGO: es la convención de getUTCDay(), no "0 = lunes" (§3.4)', () => {
    expect(weekdayLabel(0)).toBe('Domingo');
    expect(weekdayLabel(1)).toBe('Lunes');
    expect(weekdayLabel(6)).toBe('Sábado');
  });

  it('null es —: hay filas viejas sin día', () => {
    expect(weekdayLabel(null)).toBe('—');
  });

  it('un valor fuera de rango no rompe la tabla', () => {
    expect(weekdayLabel(9)).toBe('—');
  });
});

describe('WEEKDAY_OPTIONS', () => {
  it('arranca en LUNES y termina en DOMINGO: la semana argentina', () => {
    // El array WEEKDAYS está indexado por el weekday del backend (0 = domingo); el orden
    // de la SEMANA es otra cosa y se resuelve acá.
    expect(WEEKDAY_OPTIONS.map((o) => o.label))
      .toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  });

  it('los value son los del backend, no la posición en la lista', () => {
    expect(WEEKDAY_OPTIONS.map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6', '0']);
  });

  it('los value son STRINGS: es lo que devuelve un <select>', () => {
    expect(WEEKDAY_OPTIONS.every((o) => typeof o.value === 'string')).toBe(true);
  });
});
