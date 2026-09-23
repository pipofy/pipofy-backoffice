import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, from, map, shareReplay, tap, catchError, throwError } from 'rxjs';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { SessionStore } from '@domain/contracts/session-store';

/**
 * Comparte UN solo refresh entre todos los requests que fallaron con 401 al mismo tiempo.
 *
 * El refresh de la API es rotativo: auth.service.refresh() revoca el token usado antes de
 * emitir el par nuevo. Si tres requests dispararan tres refreshes en paralelo, el primero
 * revocaría el token y los otros dos quedarían con un refresh token muerto — el usuario
 * caería al login sin motivo. Con shareReplay(1) los tres se cuelgan del mismo request.
 */
@Injectable()
export class TokenRefresher {
  private readonly auth = inject(AuthRepository);
  private readonly store = inject(SessionStore);
  private readonly router = inject(Router);
  private inFlight: Observable<void> | null = null;

  run(): Observable<void> {
    if (!this.inFlight) {
      this.inFlight = from(this.auth.refresh(this.store.refreshToken()!)).pipe(
        // setTokens, no set: el refresh NO devuelve mustChangePassword (ver SessionStore).
        tap((session) => this.store.setTokens(session.accessToken, session.refreshToken)),
        map(() => undefined),
        catchError((err) => {
          this.store.clear();
          // navigate() puede rechazar por motivos ajenos a la ruta faltante (falla al cargar
          // un chunk lazy, un guard que tira) — sin manejar el rechazo queda como unhandled
          // rejection y hace fallar el test runner.
          this.router.navigate(['/login']).catch((e) => console.error('[auth] redirect a /login falló', e));
          return throwError(() => err);
        }),
        finalize(() => { this.inFlight = null; }),
        shareReplay(1),
      );
    }
    return this.inFlight;
  }
}
