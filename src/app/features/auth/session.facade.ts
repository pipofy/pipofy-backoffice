import { Injectable, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { TenantContext } from '@shared/tenant/tenant-context';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { SessionStore } from '@data/auth/session-store';

/**
 * Dueña de la sesión. Se provee en ROOT (app.config.ts) porque el shell la necesita para el
 * logout y no pertenece a ninguna ruta lazy.
 *
 * Está separada de VerificationFacade a propósito: SignalStore tiene un solo triad
 * data/loading/error, y una facade root compartida dejaría vivo el error de una pantalla
 * para mostrarlo en la siguiente (la facade root no se destruye al navegar).
 *
 * Extiende SignalStore<void, ...> (no <Session, ...>) A PROPÓSITO: la sesión real vive en
 * SessionStore, que sí se limpia explícitamente. Si el Session viviera en el data() de este
 * SignalStore quedaría ahí para siempre entre intentos de login (esta facade es root-scoped,
 * run() no limpia data() en el catch) — un login fallido leería la sesión vieja y la
 * reinstalaría. Mismo patrón que OnboardingFacade.
 */
@Injectable()
export class SessionFacade extends SignalStore<void, DomainError> {
  private readonly auth = inject(AuthRepository);
  private readonly store = inject(SessionStore);
  private readonly tenant = inject(TenantContext);

  readonly isAuthenticated = this.store.isAuthenticated;
  readonly mustChangePassword = this.store.mustChangePassword;

  async login(email: string, password: string): Promise<void> {
    // El guardado en SessionStore va DENTRO de la promesa para que run()/toDomainError se
    // limiten a publicar loading/error; nada se lee de data() después.
    await this.run(
      this.auth.login(email, password).then((session) => {
        this.store.set(session);
        // El clubId sale del JWT, no del header X-Tenant-Id (que el backend ignora). Poblarlo
        // mantiene funcionando los effect() que resetean estado al cambiar de tenant.
        this.tenant.set(this.store.clubId());
      }),
      toDomainError,
    );
  }

  async logout(): Promise<void> {
    const refreshToken = this.store.refreshToken();
    if (refreshToken) {
      try {
        await this.auth.logout(refreshToken);
      } catch {
        // Si el server no contesta, igual cerramos localmente: dejar al usuario "adentro"
        // sería peor que un refresh token huérfano (que expira solo a los 30 días).
      }
    }
    this.store.clear();
    this.tenant.set(null);
    this.reset();
  }
}
