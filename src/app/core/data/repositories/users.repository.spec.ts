import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { UsersRepository } from './users.repository';
import { ApiClient } from '../http/api-client';
import { currentUserName } from '../dto/users.dto';

const ME = {
  id: '9', clubId: '42', email: 'ana@club.com',
  nombre: 'Ana', apellido: 'Pérez', roles: ['admin'],
};

function setup(get: () => Observable<unknown>) {
  const paths: string[] = [];
  const api = { get: (p: string) => { paths.push(p); return get(); } } as unknown as ApiClient;
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      UsersRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(UsersRepository), paths };
}

describe('UsersRepository', () => {
  it('pide /users/me y valida la respuesta', async () => {
    const { repo, paths } = setup(() => of(ME));
    expect(await repo.me()).toEqual(ME);
    expect(paths).toEqual(['/users/me']);
  });

  it('acepta nombre, apellido y email en null: los tres son String? en el schema', async () => {
    const { repo } = setup(() => of({ ...ME, email: null, nombre: null, apellido: null }));
    await expect(repo.me()).resolves.toMatchObject({ nombre: null });
  });

  it('normaliza el error de red a DomainError', async () => {
    const { repo } = setup(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(repo.me()).rejects.toEqual({ kind: 'network' });
  });

  it('NO cachea: dos llamadas son dos requests', async () => {
    // Memoizar acá sería un bug de identidad — un logout+login en la misma pestaña
    // mostraría el nombre del usuario anterior.
    const { repo, paths } = setup(() => of(ME));
    await repo.me();
    await repo.me();
    expect(paths).toHaveLength(2);
  });
});

describe('currentUserName', () => {
  it('arma "Nombre Apellido"', () => {
    expect(currentUserName(ME)).toBe('Ana Pérez');
  });

  it('con uno solo de los dos, usa el que hay', () => {
    expect(currentUserName({ ...ME, apellido: null })).toBe('Ana');
    expect(currentUserName({ ...ME, nombre: '   ' })).toBe('Pérez');
  });

  it('sin nombre ni apellido cae al email', () => {
    expect(currentUserName({ ...ME, nombre: null, apellido: null })).toBe('ana@club.com');
  });

  it('sin ninguno de los tres devuelve vacío, para que el sidebar no dibuje el renglón', () => {
    expect(currentUserName({ ...ME, nombre: null, apellido: null, email: null })).toBe('');
  });
});
