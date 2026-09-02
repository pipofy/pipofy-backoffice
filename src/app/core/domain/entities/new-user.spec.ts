import { describe, it, expect } from 'vitest';
import { createNewUserDraft } from './new-user';
import { InvalidUserError } from '../errors';

const base = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' };

describe('createNewUserDraft', () => {
  it('recorta los tres campos y lleva el roleId que le pasan', () => {
    expect(createNewUserDraft({ email: '  ana@club.com  ', nombre: '  Ana  ', apellido: ' Pérez ' }, '7'))
      .toEqual({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' });
  });

  it('tira InvalidUserError cuando el email está vacío', () => {
    expect(() => createNewUserDraft({ ...base, email: '   ' }, '7')).toThrow(InvalidUserError);
  });

  it('tira InvalidUserError sin roleId', () => {
    // Es el backstop del caso §3.1: un club sin rol 'profesor'. La facade ya lo corta antes
    // con un mensaje mejor, pero el dominio no confía en la facade.
    expect(() => createNewUserDraft(base, '')).toThrow(InvalidUserError);
  });

  it('normaliza nombre y apellido vacíos a null: el mapper los omite del body', () => {
    expect(createNewUserDraft({ email: 'a@b.com', nombre: '  ', apellido: '' }, '7'))
      .toEqual({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' });
  });

  it('NO valida el formato del email: eso lo hace el form con EMAIL_RE', () => {
    // Mismo reparto que createRegistration. domain no puede importar de shared (boundaries),
    // así que duplicar el regex acá crearía dos criterios de qué es un email válido.
    expect(createNewUserDraft({ ...base, email: 'no-es-un-email' }, '7').email).toBe('no-es-un-email');
  });
});
