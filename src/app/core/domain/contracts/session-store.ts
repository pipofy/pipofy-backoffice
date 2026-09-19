import { Session } from '../entities/session';

/**
 * Dueño único de la sesión. Clase abstracta a propósito (token DI sin @angular/core).
 *
 * Los lectores se declaran como PROPIEDADES de tipo función y no como métodos: así la
 * implementación los satisface con `signal.asReadonly()` / `computed()`, y leerlos dentro de
 * otro `computed` sigue siendo reactivo. Un método abstracto no admitiría esa implementación.
 */
export abstract class SessionStore {
  abstract readonly accessToken: () => string | null;
  abstract readonly refreshToken: () => string | null;
  abstract readonly mustChangePassword: () => boolean;
  abstract readonly isAuthenticated: () => boolean;
  /** Del JWT, no del login: sobrevive un F5. */
  abstract readonly clubId: () => string | null;
  abstract readonly roles: () => readonly string[];

  /** Login: la respuesta trae mustChangePassword. */
  abstract set(session: Session): void;
  /** Refresh: sólo el par de tokens; NO pisa mustChangePassword. */
  abstract setTokens(accessToken: string, refreshToken: string): void;
  /** POST /auth/change-password no devuelve tokens: hay que bajar la bandera a mano. */
  abstract passwordChanged(): void;
  abstract clear(): void;
}
