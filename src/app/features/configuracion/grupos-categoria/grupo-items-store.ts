import { Injectable } from '@angular/core';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';

/**
 * Qué categorías tiene cada grupo de categoría, según este navegador. Toda la mecánica —y el
 * porqué de que exista una pista en vez de una lectura— está en `IdSetHintStore`.
 *
 * La clave NO cambia: los navegadores que ya tienen una asignación cargada la conservan.
 */
@Injectable()
export class GrupoItemsStore extends IdSetHintStore {
  protected readonly key = 'PipoFy:grupo-items:v1';
}
