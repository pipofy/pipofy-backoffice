import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpReservationsRepository } from './http-reservations.repository';
import { ApiClient } from '../http/api-client';

interface Call { readonly method: string; readonly path: string; readonly body?: unknown }

function setup(responses: Partial<Record<'post' | 'delete', Observable<unknown>>> = {}) {
  const calls: Call[] = [];
  const api = {
    post: (path: string, body: unknown) => {
      calls.push({ method: 'post', path, body });
      return responses.post ?? of({ id: '55', holdExpiresAt: '2026-08-19T21:30:00.000Z' });
    },
    delete: (path: string, body?: unknown) => { calls.push({ method: 'delete', path, body }); return responses.delete ?? of({}); },
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpReservationsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(HttpReservationsRepository), calls };
}

const draft = { sessionId: '10', studentId: '4', studentPlanId: '9' };

describe('HttpReservationsRepository.reserve', () => {
  it('reserve() no devuelve nada: el roster sale de GET /class-sessions/:id/reservations', async () => {
    const { repo } = setup({ post: of({ id: '55', holdExpiresAt: null }) });
    await expect(
      repo.reserve({ sessionId: '10', studentId: '4', studentPlanId: '9' }),
    ).resolves.toBeUndefined();
  });

  it('postea a la sesión con el body correcto', async () => {
    const { repo, calls } = setup();
    await repo.reserve(draft);
    expect(calls[0]).toEqual({
      method: 'post',
      path: '/class-sessions/10/reservations',
      body: { studentId: '4', studentPlanId: '9' },
    });
  });

  it('no manda sessionId en el cuerpo: va en la URL y el ValidationPipe rechaza los extras', async () => {
    const { repo, calls } = setup();
    await repo.reserve(draft);
    expect(Object.keys(calls[0].body as object).sort()).toEqual(['studentId', 'studentPlanId'].sort());
  });

  it('propaga el mensaje del backend cuando no hay cupo', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'No hay cupo disponible' } });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.reserve(draft)).rejects.toEqual({
      kind: 'domain',
      message: 'No hay cupo disponible',
    });
  });

  it('propaga el 400 de categoría, que el front no puede prevenir', async () => {
    // No hay GET que devuelva los items de un grupo, así que el modal no puede filtrar el
    // select de alumnos por categoría: el mensaje del backend ES el feedback.
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'El alumno no pertenece a la categoría de esta clase' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.reserve(draft)).rejects.toEqual({
      kind: 'domain',
      message: 'El alumno no pertenece a la categoría de esta clase',
    });
  });
});

describe('HttpReservationsRepository.confirm / cancel', () => {
  it('confirm postea al endpoint de la reserva', async () => {
    const { repo, calls } = setup();
    await repo.confirm('55');
    expect(calls[0]).toMatchObject({ method: 'post', path: '/reservations/55/confirm' });
  });

  it('cancel borra la reserva', async () => {
    const { repo, calls } = setup();
    await repo.cancel('55');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/reservations/55' });
  });

  it('confirm propaga el 409 del hold vencido', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'El hold expiró' } });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.confirm('55')).rejects.toEqual({ kind: 'domain', message: 'El hold expiró' });
  });
});

describe('HttpReservationsRepository.cancel', () => {
  it('manda offerToWaitingList: true — sin eso el cupo liberado no se le ofrece a nadie', async () => {
    // Regresión de bfe503c/584b6d3: ReservationsService.cancel() dejó de promover la lista de
    // espera. Ahora lo hace WaitingListOfferService.offerNext(), y el controlador sólo lo llama
    // si el body lo pide. Un DELETE pelado cancela bien y deja el lugar muerto.
    const { repo, calls } = setup();
    await repo.cancel('55');
    expect(calls[0]).toEqual({
      method: 'delete',
      path: '/reservations/55',
      body: { offerToWaitingList: true },
    });
  });

  it('no manda notify: sin reason el backend responde 400', async () => {
    // CancelReservationDto valida `reason` con @ValidateIf(o => o.notify === true) y
    // @MinLength(1). Mandar notify sin motivo es un 400 garantizado.
    const { repo, calls } = setup();
    await repo.cancel('55');
    expect(Object.keys(calls[0].body as object)).toEqual(['offerToWaitingList']);
  });
});

describe('HttpReservationsRepository.confirmPayment', () => {
  it('postea monto y medio de pago al endpoint de cobro', async () => {
    const { repo, calls } = setup();
    await repo.confirmPayment('55', { paymentMethodId: '2', amount: '12000.50' });
    expect(calls[0]).toEqual({
      method: 'post',
      path: '/reservations/55/confirm-payment',
      body: { paymentMethodId: '2', amount: '12000.50' },
    });
  });

  it('manda el monto como STRING: del otro lado es un new Prisma.Decimal', async () => {
    const { repo, calls } = setup();
    await repo.confirmPayment('55', { paymentMethodId: '2', amount: '12000' });
    expect(typeof (calls[0].body as { amount: unknown }).amount).toBe('string');
  });

  it('propaga el mensaje del backend cuando el hold ya venció', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'El hold expiró' } });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.confirmPayment('55', { paymentMethodId: '2', amount: '1' })).rejects.toEqual({
      kind: 'domain',
      message: 'El hold expiró',
    });
  });
});
