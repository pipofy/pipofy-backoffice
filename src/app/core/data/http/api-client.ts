import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { API_CONFIG } from '../config/api-config.token';
import { toDomainError } from './to-domain-error';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_CONFIG).apiBaseUrl;

  // `path` MUST be root-relative, e.g. '/clubs/1'. It is concatenated onto baseUrl as-is;
  // an absolute baseUrl ('https://api.pipofy.com') + a non-'/'-prefixed path yields a
  // malformed URL (no separator). Root-relative paths keep exactly one leading slash.

  get<T>(path: string): Observable<T> {
    return this.request(this.http.get<T>(`${this.baseUrl}${path}`));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.post<T>(`${this.baseUrl}${path}`, body));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.put<T>(`${this.baseUrl}${path}`, body));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.patch<T>(`${this.baseUrl}${path}`, body));
  }

  /**
   * `body` es opcional porque casi ningún DELETE lo lleva. `DELETE /reservations/:id` sí: el
   * backend lee de ahí `offerToWaitingList` y `notify`. `HttpClient` no acepta cuerpo como
   * segundo argumento posicional en DELETE —sólo dentro de las options—, y pasarle
   * `{ body: undefined }` no es lo mismo que no pasar nada, así que se omiten enteras cuando
   * no hay cuerpo.
   */
  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.request(
      this.http.delete<T>(`${this.baseUrl}${path}`, body === undefined ? undefined : { body }),
    );
  }

  // Centralizes HTTP-error -> DomainError so repos don't each repeat it.
  private request<T>(source$: Observable<T>): Observable<T> {
    return source$.pipe(catchError((err) => throwError(() => toDomainError(err))));
  }
}
