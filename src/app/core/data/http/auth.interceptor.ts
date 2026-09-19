import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { SessionStore } from '@domain/contracts/session-store';
import { TokenRefresher } from './token-refresher';

/**
 * De las diez rutas de /auth/, `change-password` es la ÚNICA detrás de JwtAuthGuard. Se
 * escribe como excepción y no como allowlist de las otras nueve: una lista de públicas hay
 * que editarla cada vez que la API suma un endpoint, y con `includes()` cada entrada es
 * además una subcadena que puede matchear una URL ajena.
 */
const AUTHENTICATED_AUTH_PATH = '/auth/change-password';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAuthRoute = req.url.includes('/auth/');
  if (isAuthRoute && !req.url.includes(AUTHENTICATED_AUTH_PATH)) return next(req);

  // inject() DEBE ser sincrónico acá arriba: dentro de catchError ya no hay contexto
  // de inyección y tira NG0203.
  const store = inject(SessionStore);
  const refresher = inject(TokenRefresher);

  const withAuth = (r: HttpRequest<unknown>) => {
    const token = store.accessToken();
    return token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  };

  return next(withAuth(req)).pipe(
    catchError((err) => {
      // isAuthRoute corta dos casos: un 401 de /auth/refresh dispararía otro refresh (loop
      // infinito), y un 401 de /auth/change-password significa "clave actual incorrecta" —
      // refrescar y reintentar manda la misma clave equivocada y rota el token de gusto.
      if (
        isAuthRoute ||
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        !store.refreshToken()
      ) {
        return throwError(() => err);
      }
      return refresher.run().pipe(switchMap(() => next(withAuth(req))));
    }),
  );
};
