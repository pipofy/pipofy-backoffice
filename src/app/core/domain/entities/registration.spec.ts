import { describe, it, expect } from 'vitest';
import { createRegistration, RegistrationInput } from './registration';
import { InvalidRegistrationError } from '../errors';

function baseInput(): RegistrationInput {
  return {
    role: 'club',
    nombre: '  Martín ',
    apellido: ' Rivas ',
    email: ' martin@club.com ',
    password: 'unaClave123',
    phone: ' +54 9 11 5555-1234 ',
    nombreClub: ' Club Solaris ',
    acceptedTerms: true,
  };
}

describe('createRegistration', () => {
  it('arma un Registration de club y recorta los espacios', () => {
    const reg = createRegistration(baseInput());
    expect(reg).toEqual({
      role: 'club',
      nombre: 'Martín',
      apellido: 'Rivas',
      email: 'martin@club.com',
      password: 'unaClave123',
      phone: '+54 9 11 5555-1234',
      nombreClub: 'Club Solaris',
      acceptedTerms: true,
    });
  });

  it('un profesor no lleva nombreClub', () => {
    const reg = createRegistration({ ...baseInput(), role: 'profesor', nombreClub: '' });
    expect(reg.role).toBe('profesor');
    expect('nombreClub' in reg).toBe(false);
  });

  it('sin rol elegido tira InvalidRegistrationError', () => {
    expect(() => createRegistration({ ...baseInput(), role: null }))
      .toThrow(InvalidRegistrationError);
  });

  it('sin términos aceptados tira InvalidRegistrationError', () => {
    expect(() => createRegistration({ ...baseInput(), acceptedTerms: false }))
      .toThrow(InvalidRegistrationError);
  });

  it('un club sin nombre de club tira InvalidRegistrationError', () => {
    expect(() => createRegistration({ ...baseInput(), nombreClub: '   ' }))
      .toThrow(InvalidRegistrationError);
  });

  it('sin teléfono tira InvalidRegistrationError', () => {
    expect(() => createRegistration({ ...baseInput(), phone: '   ' }))
      .toThrow(InvalidRegistrationError);
  });

  it('la contraseña NO se recorta: los espacios pueden ser parte de la clave', () => {
    const reg = createRegistration({ ...baseInput(), password: ' con espacios ' });
    expect(reg.password).toBe(' con espacios ');
  });
});
