import { Injectable, computed, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { Court, CourtInput, createCourtDraft } from '@domain/entities/court';
import { DomainError, asDomainError } from '@domain/errors';

/**
 * ponytail: create/update/remove reusan `loading`, así que la tabla muestra su spinner
 * mientras se guarda. Es aceptable porque el modal la tapa. Techo: si molesta, un signal
 * `saving` aparte — no antes.
 */
@Injectable()
export class CanchasFacade extends SignalStore<Court[], DomainError> {
  private readonly repo = inject(CourtsRepository);

  /**
   * El backend no ordena: courts.service.list() no tiene ORDER BY (§3.6), Postgres devuelve
   * el orden físico del heap y un UPDATE mueve la fila. Sin esto, editar una cancha la manda
   * al final de la tabla y el usuario cree que la perdió.
   *
   * Vive en la facade y no en la página porque es una propiedad de los datos, no de una
   * pantalla — mismo criterio que CategoriasFacade.sorted.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  });

  load(): Promise<void> {
    return this.run(this.repo.list(), asDomainError);
  }

  /**
   * La página lo llama al abrir el formulario: como le pasa `error()` al modal, sin esto un
   * error viejo del load() se mostraría dentro de un alta recién abierta. Vive acá y no en
   * SignalStore porque `setError` es protected y la base se mantiene mínima a propósito.
   */
  clearError(): void {
    this.setError(null);
  }

  /**
   * createCourtDraft tira de forma síncrona cuando el nombre está vacío; va DENTRO de la
   * promesa para que run()/asDomainError normalicen tanto la invariante de dominio como el
   * fallo del repo. Mismo patrón que OnboardingFacade.signup().
   */
  create(input: CourtInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.create(createCourtDraft(input)))
        .then(() => this.repo.list()),
      asDomainError,
    );
  }

  update(id: string, input: CourtInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createCourtDraft(input)))
        .then(() => this.repo.list()),
      asDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(
      this.repo.remove(id).then(() => this.repo.list()),
      asDomainError,
    );
  }
}
