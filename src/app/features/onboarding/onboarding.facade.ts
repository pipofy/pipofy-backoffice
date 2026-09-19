import { Injectable, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { createRegistration, RegistrationInput } from '@domain/entities/registration';
import { DomainError, asDomainError } from '@domain/errors';

@Injectable()
export class OnboardingFacade extends SignalStore<void, DomainError> {
  private readonly auth = inject(AuthRepository);

  /**
   * createRegistration puede tirar de forma síncrona; va DENTRO de la promesa para que
   * run()/asDomainError normalicen tanto la invariante de dominio como el fallo del repo.
   */
  signup(input: RegistrationInput): Promise<void> {
    return this.run(
      Promise.resolve().then(() => this.auth.signup(createRegistration(input))),
      asDomainError,
    );
  }
}
