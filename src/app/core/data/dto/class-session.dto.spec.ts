import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { ClassSessionListDtoSchema, WaitingListDtoSchema } from './class-session.dto';

const row = (over: Record<string, unknown> = {}) => ({
  id: '10',
  courtId: '1',
  coachId: '2',
  categoryGroupId: '3',
  startAt: '2026-08-05T21:00:00.000Z',
  capacity: 4,
  availableSpots: 1,
  waitingCount: 0,
  classSessionStatus: { id: '1', name: 'programada' },
  ...over,
});

describe('ClassSessionListDtoSchema', () => {
  it('parsea la fila cruda de Prisma en camelCase', () => {
    // El backend devuelve la fila sin transformar: @map() renombra la columna en la base,
    // no la propiedad en JS. Por eso este DTO es camelCase y no snake_case como el resto.
    expect(v.parse(ClassSessionListDtoSchema, [row()])[0]).toMatchObject({
      id: '10',
      courtId: '1',
      capacity: 4,
      availableSpots: 1,
    });
  });

  it('acepta capacity null y startAt null', () => {
    // Ambos son nullable en Prisma y ningún servicio los completa.
    const [parsed] = v.parse(ClassSessionListDtoSchema, [row({ capacity: null, startAt: null })]);
    expect(parsed.capacity).toBeNull();
    expect(parsed.startAt).toBeNull();
  });

  it('ignora los campos que el dashboard no usa', () => {
    // La fila trae clubId, notes, timestamps y más. valibot los descarta sin fallar.
    expect(() =>
      v.parse(ClassSessionListDtoSchema, [row({ notes: 'x', clubId: '1' })]),
    ).not.toThrow();
  });

  it('rechaza ids numéricos', () => {
    // Los BigInt de Prisma se serializan como string; un número indica que cambió el borde.
    expect(() => v.parse(ClassSessionListDtoSchema, [row({ id: 10 })])).toThrow();
  });
});

describe('WaitingListDtoSchema', () => {
  it('parsea las entradas y tolera el array vacío', () => {
    expect(v.parse(WaitingListDtoSchema, [])).toEqual([]);
    expect(
      v.parse(WaitingListDtoSchema, [{ id: '1', studentId: '4', requestedAt: null }]),
    ).toHaveLength(1);
  });

  it('exige la forma de cada entrada: a diferencia del dashboard, la pantalla de reservas lee adentro', () => {
    // Antes era `v.array(v.unknown())` porque el único consumidor —el dashboard— sólo usaba
    // el largo. Ahora valida cada fila: reservas necesita `studentId` y el `id` de la
    // anotación para poder darla de baja.
    expect(() => v.parse(WaitingListDtoSchema, [{ cualquierCosa: 1 }])).toThrow();
  });

  it('rechaza lo que no sea un array', () => {
    expect(() => v.parse(WaitingListDtoSchema, { id: '1' })).toThrow();
  });
});
