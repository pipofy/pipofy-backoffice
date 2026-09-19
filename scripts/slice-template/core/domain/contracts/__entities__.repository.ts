import { __Entity__, __Entity__Draft } from '../entities/__entity__';

/**
 * Clase abstracta a propósito: token DI sin @angular/core en el dominio. Las escrituras
 * devuelven void y la facade re-lee.
 */
export abstract class __Entities__Repository {
  abstract list(): Promise<__Entity__[]>;
  abstract create(draft: __Entity__Draft): Promise<void>;
  abstract update(id: string, draft: __Entity__Draft): Promise<void>;
  abstract remove(id: string): Promise<void>;
}
