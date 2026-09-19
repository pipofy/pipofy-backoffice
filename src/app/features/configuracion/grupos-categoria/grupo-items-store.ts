import { Injectable, inject } from '@angular/core';
import { APP_CONFIG, storageKey } from '@config/app-config';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';

/**
 * Qué categorías tiene cada grupo de categoría, según este navegador. Toda la mecánica —y el
 * porqué de que exista una pista en vez de una lectura— está en `IdSetHintStore`.
 *
 * La clave NO cambia: los navegadores que ya tienen una asignación cargada la conservan.
 */
@Injectable()
export class GrupoItemsStore extends IdSetHintStore {
  /** `${prefix}:grupo-items:v1`. Con el prefijo de Pipofy es la clave de siempre. */
  protected readonly key = storageKey(inject(APP_CONFIG), 'grupo-items', 1);
}
