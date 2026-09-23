import { Injectable, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { ClubRepository } from '@domain/contracts/club.repository';
import { Club, ClubInput, createClubDraft } from '@domain/entities/club';
import { DomainError, asDomainError } from '@domain/errors';

/**
 * La primera facade con `T` OBJETO y no array. Nada en SignalStore asume array, así que es
 * válido: data() es `Club | null`.
 *
 * Sin `sorted()`: no hay lista que ordenar, que es la otra diferencia con las seis restantes.
 *
 * El `loading` sigue compartido entre lectura y escritura, igual que en las otras seis. Acá
 * es más delicado porque no hay `<dialog>`: el formulario vive en el mismo chain que el
 * "Cargando…", así que el template pregunta por `data()` ANTES que por `loading()` — un
 * guardado (data() ya no-null) deja el formulario en pantalla en vez de destruirlo y
 * reemplazarlo por un texto de lectura. Ver club-page.component.html (§8.1).
 */
@Injectable()
export class ClubFacade extends SignalStore<Club, DomainError> {
  private readonly repo = inject(ClubRepository);

  load(): Promise<void> {
    return this.run(this.repo.get(), asDomainError);
  }

  /**
   * createClubDraft tira de forma SÍNCRONA cuando holdMinutes no sirve; va DENTRO de la
   * promesa para que run()/asDomainError normalicen tanto la invariante de dominio como el
   * fallo del repo. Mismo patrón que CanchasFacade.create().
   *
   * Relee con get() y no reusa el input: lo que quede en data() tiene que ser lo que el
   * servidor guardó, porque de ahí re-siembra el formulario y de ahí compara dirty().
   */
  save(input: ClubInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(createClubDraft(input)))
        .then(() => this.repo.get()),
      asDomainError,
    );
  }

  /**
   * La página lo llama antes de reintentar. Vive acá y no en SignalStore porque `setError`
   * es protected y la base se mantiene mínima a propósito (mismo motivo que en las otras).
   */
  clearError(): void {
    this.setError(null);
  }
}
