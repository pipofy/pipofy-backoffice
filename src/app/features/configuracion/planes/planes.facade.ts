import { Injectable, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Plan, PlanInput, createPlanDraft } from '@domain/entities/plan';
import { Coach } from '@domain/entities/coach';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { PlanCategoriasStore } from './plan-categorias-store';

/**
 * ponytail: create/update/remove reusan `loading`, así que la tabla muestra su spinner
 * mientras se guarda. Es aceptable porque el modal la tapa.
 */
@Injectable()
export class PlanesFacade extends SignalStore<Plan[], DomainError> {
  private readonly repo = inject(PlansRepository);
  private readonly coachesRepo = inject(CoachesRepository);
  private readonly categorias = inject(PlanCategoriasStore);

  private readonly _coaches = signal<readonly Coach[]>([]);
  /** Lookup para el select y para la columna Profesor. Vacío si su carga falló. */
  readonly coaches = this._coaches.asReadonly();

  /** El backend no ordena (§3.6): sin esto, editar un plan lo manda al final de la tabla. */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  });

  load(): Promise<void> {
    return this.run(this.repo.list(), toDomainError);
  }

  /**
   * Falla en SILENCIO a propósito, misma política que los catálogos en la página de
   * Canchas: sin profesores el select queda vacío, pero la tabla sigue siendo usable y el
   * error que importa —el de la lista de planes— es el que se muestra. Meterlo en error()
   * taparía el otro.
   *
   * No usa run() justamente por eso: run() escribe en data(), loading() y error().
   */
  async loadCoaches(): Promise<void> {
    try {
      this._coaches.set(await this.coachesRepo.list());
    } catch {
      this._coaches.set([]);
    }
  }

  /** Ver GruposCategoriaFacade.clearError(): mismo motivo, y por qué no vive en SignalStore. */
  clearError(): void {
    this.setError(null);
  }

  /**
   * SignalStore.reset() sólo limpia data/loading/error: no sabe de `_coaches`, que es estado
   * propio de esta facade. Sin este override, un futuro reset()-al-cambiar-de-tenant (como el
   * de DashboardFacade) dejaría sobrevivir el lookup de profesores del tenant anterior —
   * silencioso, porque son nombres plausibles del club equivocado.
   */
  override reset(): void {
    super.reset();
    this._coaches.set([]);
  }

  /**
   * createPlanDraft tira de forma síncrona (nombre vacío, tipo sin elegir, número decimal);
   * va DENTRO de la promesa para que run()/toDomainError normalicen tanto la invariante de
   * dominio como el fallo del repo.
   */
  create(input: PlanInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.create(createPlanDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  update(id: string, input: PlanInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createPlanDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(
      this.repo
        .remove(id)
        // La pista de categorías vive en el navegador y el backend no la conoce: si no se
        // borra acá, queda huérfana para siempre.
        .then(() => this.categorias.forget(id))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }
}
