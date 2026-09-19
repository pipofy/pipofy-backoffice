import { Injectable, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { DomainError, asDomainError } from '@domain/errors';

/**
 * Scoped a las rutas de verificación (NO root): se recrea en cada navegación, así el error
 * de una pantalla no sobrevive para aparecer en la siguiente.
 */
@Injectable()
export class VerificationFacade extends SignalStore<void, DomainError> {
  private readonly auth = inject(AuthRepository);

  private readonly _verified = signal(false);
  private readonly _sent = signal(false);
  readonly verified = this._verified.asReadonly();
  readonly sent = this._sent.asReadonly();

  async verify(token: string): Promise<void> {
    this._verified.set(false);
    await this.run(this.auth.verifyEmail(token), asDomainError);
    this._verified.set(this.error() === null);
  }

  async resend(email: string): Promise<void> {
    this._sent.set(false);
    await this.run(this.auth.resendVerification(email), asDomainError);
    this._sent.set(this.error() === null);
  }
}
