import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { toSession, toSignupDto } from './auth.mapper';
import { SessionDtoSchema, SignupRequestSchema } from '../dto/auth.dto';
import { Registration } from '@domain/entities/registration';

const club: Registration = {
  role: 'club', nombre: 'Martín', apellido: 'Rivas',
  email: 'martin@club.com', password: 'unaClave123', phone: '+54 9 11 5555-1234',
  nombreClub: 'Club Solaris', acceptedTerms: true,
};

describe('toSignupDto', () => {
  it('traduce role:"club" a tipo:"club" e incluye nombreClub', () => {
    expect(toSignupDto(club)).toEqual({
      email: 'martin@club.com', password: 'unaClave123', phone: '+54 9 11 5555-1234', tipo: 'club',
      nombre: 'Martín', apellido: 'Rivas', nombreClub: 'Club Solaris',
    });
  });

  it('traduce role:"profesor" a tipo:"particular" y OMITE nombreClub', () => {
    const dto = toSignupDto({ ...club, role: 'profesor', nombreClub: undefined });
    expect(dto.tipo).toBe('particular');
    expect('nombreClub' in dto).toBe(false);
  });

  it('OMITE nombreClub para role:"profesor" incluso si viene con valor truthy', () => {
    const dto = toSignupDto({ ...club, role: 'profesor', nombreClub: 'ShouldNotAppear' });
    expect(dto.tipo).toBe('particular');
    expect('nombreClub' in dto).toBe(false);
  });

  it('el resultado pasa el schema de request', () => {
    expect(() => v.parse(SignupRequestSchema, toSignupDto(club))).not.toThrow();
  });
});

describe('SessionDtoSchema', () => {
  it('el signup no manda mustChangePassword: cae en false', () => {
    const dto = v.parse(SessionDtoSchema, { accessToken: 'a', refreshToken: 'r' });
    expect(toSession(dto)).toEqual({ accessToken: 'a', refreshToken: 'r', mustChangePassword: false });
  });

  it('el login sí lo manda y se respeta', () => {
    const dto = v.parse(SessionDtoSchema, { accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
    expect(toSession(dto).mustChangePassword).toBe(true);
  });

  it('rechaza una respuesta sin accessToken', () => {
    expect(() => v.parse(SessionDtoSchema, { refreshToken: 'r' })).toThrow();
  });
});
