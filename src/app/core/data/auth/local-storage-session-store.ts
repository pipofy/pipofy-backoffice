import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG, storageKey } from '@config/app-config';
import { SessionStore } from '@domain/contracts/session-store';
import { Session } from '@domain/entities/session';
import { readClubId, readRoles } from './jwt-claims';

interface Persisted {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

/**
 * Dueño único de los tokens. Espejado a localStorage: la sesión sobrevive a cerrar el
 * browser (el refresh token dura 30 días del lado de la API).
 *
 * Se bindea en ROOT (app.config.ts), no en una ruta lazy: el interceptor y el guard lo
 * necesitan fuera de cualquier ruta. `{ provide: SessionStore, useClass: LocalStorageSessionStore }`.
 */
@Injectable()
export class LocalStorageSessionStore extends SessionStore {
  /** `${prefix}:session:v1`. Con el prefijo de Pipofy da la clave de siempre. */
  private readonly key = storageKey(inject(APP_CONFIG), 'session', 1);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _mustChangePassword = signal(false);

  override readonly accessToken = this._accessToken.asReadonly();
  override readonly refreshToken = this._refreshToken.asReadonly();
  override readonly mustChangePassword = this._mustChangePassword.asReadonly();
  override readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /**
   * Salen del TOKEN y no del login: `hydrate()` corre en el constructor, así que sobreviven un
   * F5. `TenantContext` sólo lo puebla `SessionFacade.login()`, y por eso no sirve como fuente.
   */
  override readonly clubId = computed(() => {
    const token = this._accessToken();
    return token === null ? null : readClubId(token);
  });

  override readonly roles = computed(() => {
    const token = this._accessToken();
    return token === null ? [] : readRoles(token);
  });

  constructor() {
    super();
    this.hydrate();
  }

  /** Login: la respuesta trae mustChangePassword. */
  override set(session: Session): void {
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
    this._mustChangePassword.set(session.mustChangePassword);
    this.persist();
  }

  /**
   * Refresh: POST /auth/refresh devuelve SOLO el par de tokens, así que el schema le
   * aplica el default `mustChangePassword: false`. Usar set() acá pisaría con false una
   * bandera que el login dejó en true, y la pantalla de cambio obligatorio dejaría de
   * exigirse a las dos horas de uso.
   */
  override setTokens(accessToken: string, refreshToken: string): void {
    this._accessToken.set(accessToken);
    this._refreshToken.set(refreshToken);
    this.persist();
  }

  /**
   * POST /auth/change-password deja `mustChangePassword` en false del lado de la API
   * (auth.service.ts:219) pero no devuelve tokens nuevos: sin esto el front se queda con la
   * bandera vieja y authGuard sigue mandando a /cambiar-clave para siempre.
   */
  override passwordChanged(): void {
    this._mustChangePassword.set(false);
    this.persist();
  }

  override clear(): void {
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._mustChangePassword.set(false);
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* storage bloqueado: la sesión en memoria ya quedó limpia */
    }
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted;
      if (typeof p.accessToken !== 'string' || typeof p.refreshToken !== 'string') return;
      this._accessToken.set(p.accessToken);
      this._refreshToken.set(p.refreshToken);
      this._mustChangePassword.set(p.mustChangePassword === true);
    } catch {
      /* storage bloqueado o JSON corrupto: se arranca sin sesión */
    }
  }

  private persist(): void {
    const access = this._accessToken();
    const refresh = this._refreshToken();
    if (access === null || refresh === null) return;
    const p: Persisted = {
      accessToken: access,
      refreshToken: refresh,
      mustChangePassword: this._mustChangePassword(),
    };
    try {
      localStorage.setItem(this.key, JSON.stringify(p));
    } catch {
      /* storage lleno o bloqueado: seguimos con la sesión en memoria */
    }
  }
}
