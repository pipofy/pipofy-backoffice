import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client';
import { API_CONFIG } from '../config/api-config.token';

function make(httpMock: Partial<HttpClient>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ApiClient,
      { provide: HttpClient, useValue: httpMock },
      { provide: API_CONFIG, useValue: { apiBaseUrl: 'https://api.test', realtimeBaseUrl: 'x' } },
    ],
  });
  return TestBed.inject(ApiClient);
}

describe('ApiClient', () => {
  it('prepends apiBaseUrl to the path on get', async () => {
    let calledUrl = '';
    const api = make({ get: (url: string) => { calledUrl = url; return of({ ok: true }); } } as unknown as HttpClient);
    const res = await firstValueFrom(api.get<{ ok: boolean }>('/clubs/1'));
    expect(calledUrl).toBe('https://api.test/clubs/1');
    expect(res).toEqual({ ok: true });
  });

  it('normalizes an HTTP 404 to a not-found DomainError', async () => {
    const api = make({ get: () => throwError(() => new HttpErrorResponse({ status: 404 })) } as unknown as HttpClient);
    await expect(firstValueFrom(api.get('/x'))).rejects.toEqual({ kind: 'not-found' });
  });

  it('delete sin body no le pasa options a HttpClient', async () => {
    let calledUrl = '';
    let calledOptions: unknown = 'no-lo-llamaron';
    const api = make({
      delete: (url: string, options?: unknown) => {
        calledUrl = url;
        calledOptions = options;
        return of({});
      },
    } as unknown as HttpClient);
    await firstValueFrom(api.delete('/courts/1'));
    expect(calledUrl).toBe('https://api.test/courts/1');
    expect(calledOptions).toBeUndefined();
  });

  it('delete con body lo manda dentro de options: HttpClient no acepta cuerpo posicional', async () => {
    let calledOptions: unknown = null;
    const api = make({
      delete: (_url: string, options?: unknown) => { calledOptions = options; return of({}); },
    } as unknown as HttpClient);
    await firstValueFrom(api.delete('/reservations/55', { offerToWaitingList: true }));
    expect(calledOptions).toEqual({ body: { offerToWaitingList: true } });
  });
});
