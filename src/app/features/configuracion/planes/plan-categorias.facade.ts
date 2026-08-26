import { Injectable, inject } from '@angular/core';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { IdSetHintFacade } from '../id-set-hint.facade';
import { PlanCategoriasStore } from './plan-categorias-store';

/**
 * Las categorías de UN plan. Toda la mecánica —selección optimista, rollback, pista del
 * navegador— está en `IdSetHintFacade`.
 *
 * Desbloquea vender: `StudentPlansService.purchase()` rechaza con 400 la compra de un plan sin
 * categorías asociadas.
 */
@Injectable()
export class PlanCategoriasFacade extends IdSetHintFacade {
  private readonly repo = inject(PlansRepository);
  protected readonly store = inject(PlanCategoriasStore);

  protected add(planId: string, categoryId: string): Promise<void> {
    return this.repo.addCategory(planId, categoryId);
  }

  protected remove(planId: string, categoryId: string): Promise<void> {
    return this.repo.removeCategory(planId, categoryId);
  }
}
