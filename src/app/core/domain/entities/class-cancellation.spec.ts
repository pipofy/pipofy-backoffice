import { describe, it, expect } from 'vitest';
import { createCancelClassDraft } from './class-cancellation';
import { InvalidCancellationError } from '../errors';

describe('createCancelClassDraft', () => {
  it('con aviso y motivo arma el draft', () => {
    expect(createCancelClassDraft({ reason: 'Se llovió', notify: true }))
      .toEqual({ notify: true, reason: 'Se llovió' });
  });

  it('exige motivo cuando se avisa: ese texto le llega a la gente', () => {
    expect(() => createCancelClassDraft({ reason: '   ', notify: true }))
      .toThrow(InvalidCancellationError);
    expect(() => createCancelClassDraft({ reason: '', notify: true }))
      .toThrow('Escribí el motivo');
  });

  it('sin aviso NO exige motivo', () => {
    expect(createCancelClassDraft({ reason: '', notify: false }))
      .toEqual({ notify: false, reason: null });
  });

  it('recorta el motivo', () => {
    expect(createCancelClassDraft({ reason: '  Se llovió  ', notify: true }).reason)
      .toBe('Se llovió');
  });

  it('un motivo escrito sin tildar el aviso igual viaja', () => {
    // El backend hoy no lo guarda —sólo lo usa para el WhatsApp—, pero mandarlo es gratis y
    // el día que lo persista, la cancelación silenciosa queda con su motivo registrado.
    expect(createCancelClassDraft({ reason: 'Cancha rota', notify: false }).reason)
      .toBe('Cancha rota');
  });
});
