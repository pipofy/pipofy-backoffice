import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '@domain/contracts/session-store';

/**
 * Vive en features/auth pero se aplica desde app.routes.ts, que está fuera de los elements
 * de boundaries: no constituye una dependencia de una feature hacia otra.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  if (!store.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  // El cambio obligatorio se corta acá y no en el submit del login: así también atrapa el
  // F5 y el deep-link, que nunca pasan por la pantalla de login. /cambiar-clave cuelga
  // FUERA del shell justamente para no pasar por este guard y entrar en loop.
  if (store.mustChangePassword()) return router.createUrlTree(['/cambiar-clave']);
  return true;
};

/**
 * Sólo exige sesión, SIN el redirect de mustChangePassword. Lo usa /cambiar-clave, que es
 * justamente el destino de ese redirect: con authGuard sería un loop.
 */
export const mustBeLoggedIn: CanActivateFn = () =>
  inject(SessionStore).isAuthenticated() || inject(Router).createUrlTree(['/login']);
