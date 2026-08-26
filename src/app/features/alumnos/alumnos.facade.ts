import { Injectable, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Student, StudentInput, createStudentDraft } from '@domain/entities/student';
import { Category } from '@domain/entities/category';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { CatalogItem } from '@data/dto/catalogs.dto';

/**
 * ponytail: create/update/remove reusan `loading`, así que la tabla muestra su spinner
 * mientras se guarda. Es aceptable porque el modal la tapa.
 */
@Injectable()
export class AlumnosFacade extends SignalStore<Student[], DomainError> {
  private readonly repo = inject(StudentsRepository);
  private readonly categoriesRepo = inject(CategoriesRepository);
  private readonly catalogs = inject(CatalogsRepository);

  private readonly _categories = signal<readonly Category[]>([]);
  /** Lookup para el select y para la columna Categoría. Vacío si su carga falló. */
  readonly categories = this._categories.asReadonly();

  private readonly _statuses = signal<readonly CatalogItem[]>([]);
  /** Ídem para la columna Estado y su select. Vacío si su carga falló. */
  readonly statuses = this._statuses.asReadonly();

  /**
   * Apellido y después nombre, con los que no tienen nombre cargado AL FINAL.
   *
   * El backend no ordena (§3.6): sin esto, editar un alumno lo manda al final de la tabla
   * porque Postgres devuelve el orden físico del heap y un UPDATE mueve la fila. Con
   * cientos de alumnos eso se lee como "lo perdí".
   *
   * Los sin nombre van últimos y no primeros: '' ordena antes que cualquier letra, y son
   * justamente las filas con menos información.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => {
      const aVacio = a.lastName === '' && a.firstName === '';
      const bVacio = b.lastName === '' && b.firstName === '';
      if (aVacio && bVacio) return a.phone.localeCompare(b.phone);
      if (aVacio) return 1;
      if (bVacio) return -1;
      const porApellido = a.lastName.localeCompare(b.lastName);
      return porApellido !== 0 ? porApellido : a.firstName.localeCompare(b.firstName);
    });
  });

  load(): Promise<void> {
    return this.run(this.repo.list(), toDomainError);
  }

  /**
   * Falla en SILENCIO a propósito, misma política que los catálogos en la página de
   * Canchas: sin categorías el select queda vacío, pero la tabla sigue siendo usable y el
   * error que importa —el de la lista de alumnos— es el que se muestra.
   *
   * No usa run() justamente por eso: run() escribe en data(), loading() y error().
   */
  async loadCategories(): Promise<void> {
    try {
      this._categories.set(await this.categoriesRepo.list());
    } catch {
      this._categories.set([]);
    }
  }

  /**
   * Mismo silencio que loadCategories, por el mismo motivo. `CatalogsRepository` memoiza,
   * así que entrar y salir de la pantalla no vuelve a pedirlo.
   */
  async loadStatuses(): Promise<void> {
    try {
      this._statuses.set(await this.catalogs.studentStatuses());
    } catch {
      this._statuses.set([]);
    }
  }

  /** Ver GruposCategoriaFacade.clearError(): mismo motivo, y por qué no vive en SignalStore. */
  clearError(): void {
    this.setError(null);
  }

  /**
   * SignalStore.reset() sólo limpia data/loading/error: no sabe de `_categories`, que es
   * estado propio de esta facade. Sin este override, un futuro reset()-al-cambiar-de-tenant
   * (como el de DashboardFacade) dejaría sobrevivir el lookup de categorías del tenant
   * anterior — silencioso, porque son nombres plausibles del club equivocado.
   */
  override reset(): void {
    super.reset();
    this._categories.set([]);
    this._statuses.set([]);
  }

  /**
   * createStudentDraft tira de forma síncrona (teléfono vacío, ranking decimal); va DENTRO
   * de la promesa para que run()/toDomainError normalicen tanto la invariante de dominio
   * como el fallo del repo — incluido el 409 por teléfono duplicado.
   */
  create(input: StudentInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.create(createStudentDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  update(id: string, input: StudentInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createStudentDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(
      this.repo.remove(id).then(() => this.repo.list()),
      toDomainError,
    );
  }
}
