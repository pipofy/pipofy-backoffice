import { Injectable, computed, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category, CategoryInput, createCategoryDraft } from '@domain/entities/category';
import { DomainError, asDomainError } from '@domain/errors';

@Injectable()
export class CategoriasFacade extends SignalStore<Category[], DomainError> {
  private readonly repo = inject(CategoriesRepository);

  /**
   * El orden vive acá y no en la página porque es una propiedad de los datos, no de una
   * pantalla: las de `levelOrder` null van AL FINAL, agrupadas y ordenadas por nombre. Son
   * las que el club todavía no jerarquizó, y un `null → 0` las pondría primeras.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => {
      if (a.levelOrder === null && b.levelOrder === null) return a.name.localeCompare(b.name);
      if (a.levelOrder === null) return 1;
      if (b.levelOrder === null) return -1;
      return a.levelOrder - b.levelOrder;
    });
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

  create(input: CategoryInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.create(createCategoryDraft(input)))
        .then(() => this.repo.list()),
      asDomainError,
    );
  }

  update(id: string, input: CategoryInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createCategoryDraft(input)))
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
