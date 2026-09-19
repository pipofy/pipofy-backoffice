import { Injectable, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { DomainError, asDomainError } from '@domain/errors';
import { SessionStore } from '@data/auth/session-store';

/**
 * Las tres operaciones de contraseña. Scoped a sus rutas (NO root), igual que
 * VerificationFacade: SignalStore tiene un solo triad data/loading/error y una facade root
 * arrastraría el error de una pantalla a la siguiente.
 *
 * Una sola facade para los tres flujos y no tres: comparten el mismo shape (dispara,
 * done()/error(), listo) y ninguna pantalla usa dos a la vez.
 */
@Injectable()
export class PasswordFacade extends SignalStore<void, DomainError> {
  private readonly auth = inject(AuthRepository);
  private readonly session = inject(SessionStore);

  private readonly _done = signal(false);
  /** La operación terminó OK. La pantalla la usa para pasar al estado de éxito. */
  readonly done = this._done.asReadonly();

  /** run() devuelve void y se traga el error en el signal: esto recupera el "¿salió bien?". */
  private async attempt(work: Promise<void>): Promise<void> {
    this._done.set(false);
    await this.run(work, asDomainError);
    this._done.set(this.error() === null);
  }

  change(currentPassword: string, newPassword: string): Promise<void> {
    return this.attempt(
      this.auth.changePassword(currentPassword, newPassword).then(() => {
        // Dentro de la promesa: si la API rechaza, la bandera NO se toca y el guard sigue
        // exigiendo el cambio.
        this.session.passwordChanged();
      }),
    );
  }

  requestReset(email: string): Promise<void> {
    return this.attempt(this.auth.requestPasswordReset(email));
  }

  confirmReset(token: string, newPassword: string): Promise<void> {
    return this.attempt(
      this.auth.confirmPasswordReset(token, newPassword).then(() => {
        // La API revoca todos los refresh tokens del usuario al confirmar
        // (auth.service.ts:269): la sesión que hubiera acá quedó muerta.
        this.session.clear();
      }),
    );
  }
}
