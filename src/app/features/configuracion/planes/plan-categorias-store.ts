import { Injectable, inject } from '@angular/core';
import { APP_CONFIG, storageKey } from '@config/app-config';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';

/**
 * Qué categorías tiene cada plan, según este navegador. Toda la mecánica —y el porqué de que
 * exista una pista en vez de una lectura— está en `IdSetHintStore`.
 */
@Injectable()
export class PlanCategoriasStore extends IdSetHintStore {
  /** `${prefix}:plan-categorias:v1`. Con el prefijo de Pipofy es la clave de siempre. */
  protected readonly key = storageKey(inject(APP_CONFIG), 'plan-categorias', 1);
}
