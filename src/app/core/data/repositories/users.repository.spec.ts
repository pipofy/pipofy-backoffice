import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { UsersRepository } from './users.repository';
import { ApiClient } from '../http/api-client';
import { currentUserName } from '../dto/users.dto';

const ME = {
  id: '9',
  clubId: '42',
  email: 'ana@club.com',
  nombre: 'Ana',
  apellido: 'Pérez',
  roles: ['admin'],
};

function setup(get: () => Observable<unknown>, post: () => Observable<unknown> = () => of({})) {
  const paths: string[] = [];
  const bodies: unknown[] = [];
  const api = {
    get: (p: string) => {
      paths.push(p);
      return get();
    },
    post: (p: string, body: unknown) => {
      paths.push(p);
      bodies.push(body);
      return post();
    },
  } as unknown as ApiClient;
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      UsersRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(UsersRepository), paths, bodies };
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

describe('UsersRepository.roles', () => {
  const ROLES = [
    { id: '3', name: 'admin' },
    { id: '7', name: 'profesor' },
  ];

  it('pide /roles y parsea con el schema de catálogos', async () => {
    const { repo, paths } = setup(() => of(ROLES));
    expect(await repo.roles()).toEqual(ROLES);
    expect(paths).toEqual(['/roles']);
  });

  it('NO cachea: dos llamadas son dos requests', async () => {
    // Los roles son DEL CLUB del JWT. Memoizarlos serviría los del club anterior después de
    // un logout+login en la misma pestaña (§3.4).
    const { repo, paths } = setup(() => of(ROLES));
    await repo.roles();
    await repo.roles();
    expect(paths).toHaveLength(2);
  });

  it('normaliza el error de red a DomainError', async () => {
    const { repo } = setup(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(repo.roles()).rejects.toEqual({ kind: 'network' });
  });
});

describe('UsersRepository.create', () => {
  const DRAFT = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' };

  it('postea a /users el body del mapper', async () => {
    const { repo, paths, bodies } = setup(
      () => of({}),
      () => of({ id: '9', email: 'ana@club.com' }),
    );
    await repo.create(DRAFT);
    expect(paths).toEqual(['/users']);
    expect(bodies[0]).toEqual({
      email: 'ana@club.com',
      nombre: 'Ana',
      apellido: 'Pérez',
      roleId: '7',
    });
  });

  it('con nombre y apellido en null no manda esas claves', async () => {
    const { repo, bodies } = setup(
      () => of({}),
      () => of({}),
    );
    await repo.create({ ...DRAFT, nombre: null, apellido: null });
    expect(bodies[0]).toEqual({ email: 'ana@club.com', roleId: '7' });
  });

  it('el 409 de email repetido sale como domain con el texto del backend', async () => {
    const { repo } = setup(
      () => of({}),
      () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { statusCode: 409, message: 'Ya existe un usuario con ese email' },
            }),
        ),
    );
    await expect(repo.create(DRAFT)).rejects.toEqual({
      kind: 'domain',
      message: 'Ya existe un usuario con ese email',
    });
  });
});
