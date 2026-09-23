import { describe, it, expect } from 'vitest';
import { ScheduleDto } from '../dto/schedules.dto';
import { toSchedule, toScheduleRequest } from './schedule.mapper';
import { ScheduleDraft } from '@domain/entities/schedule';

const DTO: ScheduleDto = {
  id: '1', courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
  weekday: 1,
  startTime: '1970-01-01T18:00:00.000Z',
  endTime: '1970-01-01T19:30:00.000Z',
  capacity: 8, active: true,
  validFrom: '2026-08-01T00:00:00.000Z',
  validTo: '2026-12-31T00:00:00.000Z',
};

describe('toSchedule', () => {
  it('recorta las horas del DateTime completo (§3.2)', () => {
    const s = toSchedule(DTO);
    expect(s.startTime).toBe('18:00');
    expect(s.endTime).toBe('19:30');
  });

  it('NO convierte a la zona local: la hora ya viene en UTC por construcción', () => {
    // El service arma la hora con new Date('1970-01-01T18:00:00Z'). Pasarla por
    // toLocaleTimeString la correría tres horas en Argentina.
    expect(toSchedule({ ...DTO, startTime: '1970-01-01T00:30:00.000Z' }).startTime).toBe('00:30');
  });

  it('recorta las fechas de vigencia al formato de <input type="date">', () => {
    const s = toSchedule(DTO);
    expect(s.validFrom).toBe('2026-08-01');
    expect(s.validTo).toBe('2026-12-31');
  });

  it('las horas null quedan null: son DateTime? y generateSessions saltea esas filas', () => {
    const s = toSchedule({ ...DTO, startTime: null, endTime: null, weekday: null });
    expect(s.startTime).toBeNull();
    expect(s.endTime).toBeNull();
    expect(s.weekday).toBeNull();
  });

  it('un formato inesperado degrada a null en vez de tirar', () => {
    // Modo de falla elegido (§3.2): §3.2 es una INFERENCIA sobre cómo Prisma serializa
    // @db.Time. Si estuviera mal, la fila muestra — y la lista sigue viva.
    expect(toSchedule({ ...DTO, startTime: 'mediodía' }).startTime).toBeNull();
    expect(toSchedule({ ...DTO, validFrom: 'ayer' }).validFrom).toBeNull();
  });
});

describe('toScheduleRequest', () => {
  const DRAFT: ScheduleDraft = {
    courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
    weekday: 1, startTime: '18:00', endTime: '19:30',
    capacity: 8, active: true,
    validFrom: '2026-08-01', validTo: '2026-12-31',
  };

  it('OMITE validFrom y validTo cuando son null (§3.7)', () => {
    // El service hace `dto.validFrom ? new Date(...) : undefined`, o sea que mandar null
    // NO las vacía: las deja como estaban. Omitir la clave es lo mismo y más barato.
    const req = toScheduleRequest({ ...DRAFT, validFrom: null, validTo: null });
    expect('validFrom' in req).toBe(false);
    expect('validTo' in req).toBe(false);
  });

  it('MANDA capacity EN null: su columna sí se vacía', () => {
    // Contraste deliberado con las dos de arriba, DENTRO DEL MISMO MAPPER. Los dos tests
    // existen para que un refactor que "unifique" las reglas rompa en rojo.
    const req = toScheduleRequest({ ...DRAFT, capacity: null });
    expect('capacity' in req).toBe(true);
    expect(req.capacity).toBeNull();
  });

  it('weekday viaja como number', () => {
    const req = toScheduleRequest(DRAFT);
    expect(typeof req.weekday).toBe('number');
  });

  it('manda los once campos cuando están todos', () => {
    // La red que ataja una clave perdida: si alguien saca `sessionTypeId` del objeto literal
    // del mapper, los otros tests siguen verdes y el alta pierde el campo en silencio.
    expect(toScheduleRequest(DRAFT)).toEqual(DRAFT);
  });

  it('NO manda price: el backend lo rechaza con 400', () => {
    // CreateScheduleDto no declara el campo y el pipe corre con forbidNonWhitelisted, así
    // que mandarlo rompe el alta y la edición enteras. Verificado contra el server: el mismo
    // body con price da 400 "property price should not exist", y sin él da 201.
    expect('price' in toScheduleRequest(DRAFT)).toBe(false);
  });
});
