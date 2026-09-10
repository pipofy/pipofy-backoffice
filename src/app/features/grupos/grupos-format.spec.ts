import { describe, it, expect } from 'vitest';
import { fechaCorta, groupTitle, horaCorta, initials, occupancyState } from './grupos-format';
import { Group } from '@domain/entities/group';

describe('occupancyState', () => {
  it('lleno cuando llega o pasa la capacidad', () => {
    expect(occupancyState(4, 4)).toBe('full');
    expect(occupancyState(5, 4)).toBe('full');
  });

  it('el borde EXACTO de 50% es low', () => {
    expect(occupancyState(2, 4)).toBe('low');
    expect(occupancyState(1, 4)).toBe('low');
  });

  it('entre 50% y lleno es ok', () => {
    expect(occupancyState(3, 4)).toBe('ok');
  });

  it('capacity 0 es full y nunca divide por cero', () => {
    expect(occupancyState(0, 0)).toBe('full');
  });
});

describe('groupTitle', () => {
  const g = { category: '7ma+8va', weekday: 1, startTime: '18:00' } as Group;

  it('junta categoría, día y hora', () => {
    expect(groupTitle(g)).toBe('7ma+8va · Lunes 18:00');
  });

  // Hay templates viejos sin día ni hora: generateSessions los saltea, pero existen y se listan.
  it('se queda con la categoría sola cuando no hay día ni hora', () => {
    expect(groupTitle({ ...g, weekday: null, startTime: null } as Group)).toBe('7ma+8va');
  });
});

describe('fechaCorta / horaCorta', () => {
  // test-setup.ts fija TZ=America/Argentina/Buenos_Aires. Sin eso este test pasa aunque la
  // lógica esté rota: 21:00Z es 18:00 en Argentina y 21:00 en UTC.
  it('formatea en zona local, no en UTC', () => {
    expect(fechaCorta('2026-09-14T21:00:00.000Z')).toBe('14/09');
    expect(horaCorta('2026-09-14T21:00:00.000Z')).toBe('18:00');
  });

  it('cruza el día hacia atrás cuando corresponde', () => {
    expect(fechaCorta('2026-09-15T02:00:00.000Z')).toBe('14/09');
    expect(horaCorta('2026-09-15T02:00:00.000Z')).toBe('23:00');
  });

  it('devuelve guión sin fecha o con basura', () => {
    expect(fechaCorta(null)).toBe('—');
    expect(horaCorta('no es una fecha')).toBe('—');
  });
});

describe('initials', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(initials('Lucía Pereyra')).toBe('LP');
    expect(initials('María del Carmen Ruiz')).toBe('MD');
    expect(initials('Cher')).toBe('C');
  });

  it('devuelve guión con el nombre vacío', () => {
    expect(initials('')).toBe('—');
  });
});
