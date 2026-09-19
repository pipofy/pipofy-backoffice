import { describe, it, expect } from 'vitest';
import {
  ScheduleInput,
  createScheduleDraft,
  createSessionGenerationDraft,
  MAX_GENERATION_DAYS,
  createScheduleDrafts,
  sessionRangeForSchedule,
} from './schedule';
import { InvalidScheduleError, InvalidNumberError } from '../errors';

const BASE: ScheduleInput = {
  courtId: '1', coachId: '2', categoryGroupId: '3', sessionTypeId: '4',
  weekdays: ['1'], startTime: '18:00', endTime: '19:30',
  capacity: '8', price: '12000', active: true,
  validFrom: '', validTo: '',
};

describe('createScheduleDraft', () => {
  it('arma el draft completo', () => {
    expect(createScheduleDraft(BASE)).toEqual({
      courtId: '1', coachId: '2', categoryGroupId: '3', sessionTypeId: '4',
      weekday: 1, startTime: '18:00', endTime: '19:30',
      capacity: 8, price: '12000', active: true,
      validFrom: null, validTo: null,
    });
  });

  it('weekday viaja como NUMBER: @IsInt() sin enableImplicitConversion (§3.3)', () => {
    expect(createScheduleDraft(BASE).weekday).toBe(1);
    expect(typeof createScheduleDraft(BASE).weekday).toBe('number');
  });

  it('price viaja como STRING: @IsNumberString(), un número JSON da 400 (§3.3)', () => {
    expect(typeof createScheduleDraft(BASE).price).toBe('string');
  });

  it('cada FK vacío tira nombrando SU campo', () => {
    expect(() => createScheduleDraft({ ...BASE, courtId: '' })).toThrow(/cancha/i);
    expect(() => createScheduleDraft({ ...BASE, coachId: '' })).toThrow(/profesor/i);
    expect(() => createScheduleDraft({ ...BASE, categoryGroupId: '' })).toThrow(/grupo/i);
    expect(() => createScheduleDraft({ ...BASE, sessionTypeId: '' })).toThrow(/tipo de clase/i);
  });

  it('los cuatro FK vacíos tiran InvalidScheduleError', () => {
    expect(() => createScheduleDraft({ ...BASE, courtId: '' })).toThrow(InvalidScheduleError);
  });

  it('weekday vacío NO puede caer en domingo', () => {
    // §3.4: Number('') es 0, que es un weekday VÁLIDO. Sin el chequeo del vacío ANTES de
    // convertir, un select sin elegir se guardaría como domingo en silencio.
    expect(() => createScheduleDraft({ ...BASE, weekdays: [''] })).toThrow(InvalidScheduleError);
    expect(() => createScheduleDraft({ ...BASE, weekdays: ['   '] })).toThrow(InvalidScheduleError);
  });

  it('weekday 0 (domingo) SÍ es válido', () => {
    expect(createScheduleDraft({ ...BASE, weekdays: ['0'] }).weekday).toBe(0);
  });

  it('weekday 6 (sábado) SÍ es válido, y 7 no', () => {
    expect(createScheduleDraft({ ...BASE, weekdays: ['6'] }).weekday).toBe(6);
    expect(() => createScheduleDraft({ ...BASE, weekdays: ['7'] })).toThrow(InvalidScheduleError);
    expect(() => createScheduleDraft({ ...BASE, weekdays: ['-1'] })).toThrow(InvalidScheduleError);
    expect(() => createScheduleDraft({ ...BASE, weekdays: ['lunes'] })).toThrow(InvalidScheduleError);
  });

  it('las horas con formato inválido tiran', () => {
    expect(() => createScheduleDraft({ ...BASE, startTime: '' })).toThrow(/hora de inicio/i);
    expect(() => createScheduleDraft({ ...BASE, startTime: '25:00' })).toThrow(/hora de inicio/i);
    expect(() => createScheduleDraft({ ...BASE, startTime: '18:60' })).toThrow(/hora de inicio/i);
    expect(() => createScheduleDraft({ ...BASE, endTime: '' })).toThrow(/hora de fin/i);
  });

  it('endTime IGUAL a startTime tira: una clase de cero minutos no existe', () => {
    expect(() => createScheduleDraft({ ...BASE, startTime: '18:00', endTime: '18:00' }))
      .toThrow(InvalidScheduleError);
  });

  it('endTime ANTERIOR a startTime tira — el backend NO lo valida (§3.6)', () => {
    // Sin esto, generateSessions crea ClassSession con endAt < startAt, y NO hay endpoint
    // que las borre. Es la invariante más cara del slice.
    expect(() => createScheduleDraft({ ...BASE, startTime: '20:00', endTime: '18:00' }))
      .toThrow(/posterior/i);
  });

  it('la comparación de horas funciona con el cero a la izquierda', () => {
    expect(createScheduleDraft({ ...BASE, startTime: '09:30', endTime: '18:00' }).startTime).toBe('09:30');
    expect(() => createScheduleDraft({ ...BASE, startTime: '18:00', endTime: '09:30' })).toThrow();
  });

  it('capacity vacío es null, y tira InvalidNumberError cuando no sirve', () => {
    // optionalInt es quien lanza, NO createScheduleDraft. Mismo patrón que plan.ts.
    expect(createScheduleDraft({ ...BASE, capacity: '' }).capacity).toBeNull();
    expect(createScheduleDraft({ ...BASE, capacity: '0' }).capacity).toBe(0);
    expect(() => createScheduleDraft({ ...BASE, capacity: '8.5' })).toThrow(InvalidNumberError);
    expect(() => createScheduleDraft({ ...BASE, capacity: '-2' })).toThrow(InvalidNumberError);
  });

  it('price vacío es null', () => {
    expect(createScheduleDraft({ ...BASE, price: '   ' }).price).toBeNull();
  });

  it('la vigencia vacía es null, y la invertida tira', () => {
    expect(createScheduleDraft({ ...BASE, validFrom: '2026-01-01', validTo: '' }).validTo).toBeNull();
    expect(() => createScheduleDraft({ ...BASE, validFrom: '2026-03-01', validTo: '2026-01-01' }))
      .toThrow(/anterior/i);
  });

  it('la vigencia con el mismo día en las dos puntas es válida', () => {
    const d = createScheduleDraft({ ...BASE, validFrom: '2026-01-01', validTo: '2026-01-01' });
    expect(d.validFrom).toBe('2026-01-01');
  });

  it('una fecha con formato inválido tira', () => {
    expect(() => createScheduleDraft({ ...BASE, validFrom: '01/01/2026' })).toThrow(/vigente desde/i);
    expect(() => createScheduleDraft({ ...BASE, validTo: '2026-1-1' })).toThrow(/vigente hasta/i);
  });

  it('validFrom imposible (2026-02-30) tira nombrando "vigente desde", aunque el formato sea válido', () => {
    // Mismo caso que assertRealDate ya cubre en createSessionGenerationDraft: Date.parse NO
    // da NaN acá, rueda en silencio a 2026-03-02. Sin assertRealDate esto pasaba de largo.
    expect(() => createScheduleDraft({ ...BASE, validFrom: '2026-02-30', validTo: '2026-03-15' }))
      .toThrow(/vigente desde/i);
  });

  it('validTo imposible (2026-02-30) tira nombrando "vigente hasta": el caso simétrico', () => {
    expect(() => createScheduleDraft({ ...BASE, validFrom: '2026-02-01', validTo: '2026-02-30' }))
      .toThrow(/vigente hasta/i);
  });

  it('un 29 de febrero de un bisiesto DE VERDAD (2024) sigue siendo aceptado', () => {
    expect(createScheduleDraft({ ...BASE, validFrom: '2024-02-29', validTo: '2024-03-15' }).validFrom)
      .toBe('2024-02-29');
  });

  it('active viaja tal cual', () => {
    expect(createScheduleDraft({ ...BASE, active: false }).active).toBe(false);
  });
});

describe('createSessionGenerationDraft', () => {
  it('deja pasar un rango válido', () => {
    expect(createSessionGenerationDraft({ from: '2026-08-03', to: '2026-08-30' }))
      .toEqual({ from: '2026-08-03', to: '2026-08-30' });
  });

  it('el mismo día en las dos puntas es válido: un día inclusive', () => {
    expect(createSessionGenerationDraft({ from: '2026-08-03', to: '2026-08-03' }).to).toBe('2026-08-03');
  });

  it('el rango invertido tira', () => {
    expect(() => createSessionGenerationDraft({ from: '2026-08-30', to: '2026-08-03' }))
      .toThrow(/anterior/i);
  });

  it('60 días inclusive PASA, y 61 tira', () => {
    // inclusiveDays cuenta las DOS puntas: 60 días inclusive es to = from + 59.
    // 2026-01-01 → 2026-03-01 son exactamente 60 (31 de enero + 28 de febrero + 1).
    expect(createSessionGenerationDraft({ from: '2026-01-01', to: '2026-03-01' }).to).toBe('2026-03-01');
    expect(() => createSessionGenerationDraft({ from: '2026-01-01', to: '2026-03-02' }))
      .toThrow(/60 días/);
  });

  it('el mensaje del límite explica POR QUÉ, porque no se puede deshacer', () => {
    expect(() => createSessionGenerationDraft({ from: '2026-01-01', to: '2026-12-31' }))
      .toThrow(/no se pueden borrar/i);
  });

  it('mes o día fuera de rango sintáctico da NaN, y eso ya se atajaba', () => {
    // YMD valida forma, no validez: '2026-13-45' pasa el regex, pero Date.parse da NaN.
    expect(() => createSessionGenerationDraft({ from: '2026-13-45', to: '2026-08-30' }))
      .toThrow(/fecha de inicio/i);
    expect(() => createSessionGenerationDraft({ from: '2026-08-03', to: '2026-13-45' }))
      .toThrow(/fecha de fin/i);
  });

  it('un día de mes imposible pero sintácticamente en rango NO da NaN: Date.parse rueda en silencio', () => {
    // '2026-02-30' no da NaN: Date.parse la rueda a '2026-03-02'. El 'to' de cada caso es
    // una fecha VÁLIDA a propósito, para que el único motivo posible de que tire sea que el
    // 'from' imposible se haya detectado (y no que el NaN venga del otro lado del rango).
    expect(() => createSessionGenerationDraft({ from: '2026-02-30', to: '2026-03-15' }))
      .toThrow(/fecha de inicio/i);
    expect(() => createSessionGenerationDraft({ from: '2026-04-31', to: '2026-05-15' }))
      .toThrow(/fecha de inicio/i);
  });

  it('el caso simétrico: la fecha imposible por rollover en el "to" también tira', () => {
    expect(() => createSessionGenerationDraft({ from: '2026-02-01', to: '2026-02-30' }))
      .toThrow(/fecha de fin/i);
  });

  it('una fecha con formato equivocado tira', () => {
    expect(() => createSessionGenerationDraft({ from: '', to: '2026-08-30' })).toThrow(/fecha de inicio/i);
    expect(() => createSessionGenerationDraft({ from: '2026-08-03', to: '' })).toThrow(/fecha de fin/i);
    expect(() => createSessionGenerationDraft({ from: '03/08/2026', to: '2026-08-30' })).toThrow();
  });

  it('MAX_GENERATION_DAYS es 60', () => {
    expect(MAX_GENERATION_DAYS).toBe(60);
  });
});

describe('createScheduleDrafts', () => {
  it('devuelve UN draft por día, con todo lo demás igual', () => {
    const drafts = createScheduleDrafts({ ...BASE, weekdays: ['1', '3', '5'] });
    expect(drafts.map((d) => d.weekday)).toEqual([1, 3, 5]);
    expect(new Set(drafts.map((d) => d.startTime))).toEqual(new Set(['18:00']));
  });

  it('deduplica: dos chips del mismo día no son dos horarios idénticos', () => {
    expect(createScheduleDrafts({ ...BASE, weekdays: ['2', '2'] }).map((d) => d.weekday)).toEqual([2]);
  });

  it('sin ningún día tira, en vez de crear cero horarios en silencio', () => {
    expect(() => createScheduleDrafts({ ...BASE, weekdays: [] })).toThrow(InvalidScheduleError);
  });

  it('valida las horas UNA vez, antes de multiplicar por día', () => {
    expect(() => createScheduleDrafts({ ...BASE, weekdays: ['1', '3'], endTime: '17:00' }))
      .toThrow(InvalidScheduleError);
  });

  it('createScheduleDraft (la edición) RECHAZA más de un día', () => {
    expect(() => createScheduleDraft({ ...BASE, weekdays: ['1', '3'] })).toThrow(InvalidScheduleError);
  });
});

describe('sessionRangeForSchedule', () => {
  it('sin vigencia, cuatro semanas desde hoy — 28 días CONTANDO el de hoy', () => {
    expect(sessionRangeForSchedule({ validFrom: null, validTo: null }, '2026-03-01'))
      .toEqual({ from: '2026-03-01', to: '2026-03-28' });
  });

  it('respeta la vigencia cuando entra en el tope', () => {
    expect(sessionRangeForSchedule({ validFrom: '2026-04-10', validTo: '2026-04-20' }, '2026-03-01'))
      .toEqual({ from: '2026-04-10', to: '2026-04-20' });
  });

  it('una vigencia que ya empezó arranca HOY: las clases pasadas no se pueden borrar', () => {
    expect(sessionRangeForSchedule({ validFrom: '2026-01-01', validTo: '2026-03-10' }, '2026-03-01'))
      .toEqual({ from: '2026-03-01', to: '2026-03-10' });
  });

  it('una vigencia larga se RECORTA al tope en vez de ser rechazada entera', () => {
    // Sin el recorte, createSessionGenerationDraft tiraría por pasarse de los 60 días y no se
    // generaría NINGUNA clase — el peor desenlace de los tres.
    const r = sessionRangeForSchedule({ validFrom: null, validTo: '2027-12-31' }, '2026-03-01')!;
    expect(r.from).toBe('2026-03-01');
    expect(() => createSessionGenerationDraft(r)).not.toThrow();
    expect(r.to).toBe('2026-04-29');
    // 60 días contando el from, que es como los cuenta createSessionGenerationDraft.
  });

  it('el recorte cae EXACTAMENTE en el tope del dominio', () => {
    const r = sessionRangeForSchedule({ validFrom: null, validTo: '2099-01-01' }, '2026-03-01')!;
    const dias = (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000 + 1;
    expect(dias).toBe(MAX_GENERATION_DAYS);
  });

  it('una vigencia ya terminada no genera nada', () => {
    expect(sessionRangeForSchedule({ validFrom: null, validTo: '2020-01-01' }, '2026-03-01')).toBeNull();
  });
});
