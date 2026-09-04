import { Injectable } from '@angular/core';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';

/**
 * Qué categorías tiene cada plan, según este navegador. Toda la mecánica —y el porqué de que
 * exista una pista en vez de una lectura— está en `IdSetHintStore`.
 */
@Injectable()
export class PlanCategoriasStore extends IdSetHintStore {
  protected readonly key = 'PipoFy:plan-categorias:v1';
}
