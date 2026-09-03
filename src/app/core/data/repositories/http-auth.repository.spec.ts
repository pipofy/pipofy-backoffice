import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { HttpAuthRepository } from './http-auth.repository';
import { API_CONFIG } from '../config/api-config.token';
import { Registration } from '@domain/entities/registration';

const club: Registration = {
  role: 'club', nombre: 'Martín', apellido: 'Rivas',
  email: 'martin@club.com', password: 'unaClave123', phone: '+54 9 11 5555-1234',
  nombreClub: 'Club Solaris', acceptedTerms: true,
};

function repo(httpMock: Partial<HttpClient>): HttpAuthRepository {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpAuthRepository,
      { provide: HttpClient, useValue: httpMock },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '/api/stream' } },
    ],
  });
  return TestBed.inject(HttpAuthRepository);
}

const failWith = (status: number) => ({
  post: () => throwError(() => new HttpErrorResponse({ status })),
}) as unknown as Partial<HttpClient>;

describe('HttpAuthRepository.login', () => {
  it('devuelve la Session en el camino feliz', async () => {
    const r = repo({ post: () => of({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true }) } as unknown as Partial<HttpClient>);
    await expect(r.login('a@b.com', 'x')).resolves.toEqual({
      accessToken: 'a', refreshToken: 'r', mustChangePassword: true,
    });
  });

  it('401 -> invalid-credentials (NO unauthorized)', async () => {
    await expect(repo(failWith(401)).login('a@b.com', 'x'))
      .rejects.toEqual({ kind: 'invalid-credentials' });
  });

  it('403 -> email-not-verified', async () => {
    await expect(repo(failWith(403)).login('a@b.com', 'x'))
      .rejects.toEqual({ kind: 'email-not-verified' });
  });

  it('un 500 cae en el mapeo genérico', async () => {
    await expect(repo(failWith(500)).login('a@b.com', 'x'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.signup', () => {
  it('manda el DTO traducido y resuelve void', async () => {
    let body: unknown = null;
    const r = repo({ post: (_u: string, b: unknown) => { body = b; return of({ accessToken: 'a', refreshToken: 'r' }); } } as unknown as Partial<HttpClient>);
    await expect(r.signup(club)).resolves.toBeUndefined();
    expect(body).toEqual({
      email: 'martin@club.com', password: 'unaClave123', tipo: 'club',
      nombre: 'Martín', apellido: 'Rivas', phone: '+54 9 11 5555-1234',
      nombreClub: 'Club Solaris',
    });
  });

  it('409 -> domain con copy de email duplicado', async () => {
    await expect(repo(failWith(409)).signup(club))
      .rejects.toEqual({ kind: 'domain', message: 'Ese email ya está registrado.' });
  });
});

describe('HttpAuthRepository.verifyEmail', () => {
  it('resuelve con la respuesta 204 (body null)', async () => {
    const r = repo({ post: () => of(null) } as unknown as Partial<HttpClient>);
    await expect(r.verifyEmail('t')).resolves.toBeUndefined();
  });

  it('400 -> domain con copy de link vencido', async () => {
    await expect(repo(failWith(400)).verifyEmail('t'))
      .rejects.toEqual({ kind: 'domain', message: 'El link venció o ya fue usado.' });
  });
});

describe('HttpAuthRepository.refresh', () => {
  it('manda el refreshToken al endpoint correcto y mapea la Session', async () => {
    let url = '';
    let body: unknown = null;
    const r = repo({
      post: (u: string, b: unknown) => { url = u; body = b; return of({ accessToken: 'a2', refreshToken: 'r2' }); },
    } as unknown as Partial<HttpClient>);
    // /auth/refresh NO manda mustChangePassword: el default del schema lo completa en false.
    // Task 7 depende de esto: SessionStore.setTokens() existe separado de set() precisamente
    // porque un refresh no debe pisar el mustChangePassword ya guardado con un false espurio.
    await expect(r.refresh('r1')).resolves.toEqual({
      accessToken: 'a2', refreshToken: 'r2', mustChangePassword: false,
    });
    expect(url).toBe('/api/auth/refresh');
    expect(body).toEqual({ refreshToken: 'r1' });
  });

  it('un error cae en el mapeo genérico (no hay fila propia para refresh)', async () => {
    await expect(repo(failWith(500)).refresh('r1'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.logout', () => {
  it('manda el refreshToken y resuelve void', async () => {
    let body: unknown = null;
    const r = repo({ post: (_u: string, b: unknown) => { body = b; return of(null); } } as unknown as Partial<HttpClient>);
    await expect(r.logout('r1')).resolves.toBeUndefined();
    expect(body).toEqual({ refreshToken: 'r1' });
  });

  it('un error rechaza con el mapeo genérico (no lo traga)', async () => {
    await expect(repo(failWith(500)).logout('r1'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.resendVerification', () => {
  it('manda el email y resuelve void', async () => {
    let body: unknown = null;
    const r = repo({ post: (_u: string, b: unknown) => { body = b; return of(null); } } as unknown as Partial<HttpClient>);
    await expect(r.resendVerification('a@b.com')).resolves.toBeUndefined();
    expect(body).toEqual({ email: 'a@b.com' });
  });

  it('un error cae en el mapeo genérico', async () => {
    await expect(repo(failWith(500)).resendVerification('a@b.com'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.changePassword', () => {
  it('manda las dos claves al endpoint correcto y resuelve void', async () => {
    let url = '';
    let body: unknown = null;
    const r = repo({ post: (u: string, b: unknown) => { url = u; body = b; return of(null); } } as unknown as Partial<HttpClient>);
    await expect(r.changePassword('vieja123', 'nuevaClave123')).resolves.toBeUndefined();
    expect(url).toBe('/api/auth/change-password');
    expect(body).toEqual({ currentPassword: 'vieja123', newPassword: 'nuevaClave123' });
  });

  // El 401 de ESTE endpoint es "la clave actual no coincide" (auth.service.ts:213), no
  // "tu sesión venció": mapearlo a 'unauthorized' mostraría el copy equivocado y, peor,
  // el shell podría desloguear a alguien que sólo escribió mal su contraseña.
  it('401 -> domain con copy de clave actual incorrecta', async () => {
    await expect(repo(failWith(401)).changePassword('mal', 'nuevaClave123'))
      .rejects.toEqual({ kind: 'domain', message: 'La contraseña actual es incorrecta.' });
  });

  it('un error cae en el mapeo genérico', async () => {
    await expect(repo(failWith(500)).changePassword('vieja123', 'nuevaClave123'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.requestPasswordReset', () => {
  it('manda el email y resuelve void', async () => {
    let url = '';
    let body: unknown = null;
    const r = repo({ post: (u: string, b: unknown) => { url = u; body = b; return of(null); } } as unknown as Partial<HttpClient>);
    await expect(r.requestPasswordReset('a@b.com')).resolves.toBeUndefined();
    expect(url).toBe('/api/auth/password-reset/request');
    expect(body).toEqual({ email: 'a@b.com' });
  });

  it('un error cae en el mapeo genérico', async () => {
    await expect(repo(failWith(500)).requestPasswordReset('a@b.com'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpAuthRepository.confirmPasswordReset', () => {
  it('manda token y clave nueva al endpoint correcto y resuelve void', async () => {
    let url = '';
    let body: unknown = null;
    const r = repo({ post: (u: string, b: unknown) => { url = u; body = b; return of(null); } } as unknown as Partial<HttpClient>);
    await expect(r.confirmPasswordReset('tok', 'nuevaClave123')).resolves.toBeUndefined();
    expect(url).toBe('/api/auth/password-reset/confirm');
    expect(body).toEqual({ token: 'tok', newPassword: 'nuevaClave123' });
  });

  it('400 -> domain con copy de link vencido', async () => {
    await expect(repo(failWith(400)).confirmPasswordReset('tok', 'nuevaClave123'))
      .rejects.toEqual({ kind: 'domain', message: 'El link venció o ya fue usado.' });
  });
});
