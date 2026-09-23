import { CatalogItem } from '../entities/catalog-item';
import { CurrentUser } from '../entities/current-user';
import { NewUser } from '../entities/new-user';

/**
 * El usuario logueado, los roles del club y el alta de usuarios. `create` devuelve void y el
 * llamador relee. OJO (§3.2 de alta-de-profesor): el backend NO es atómico; un 500 puede dejar
 * el usuario creado. No asumir que un rechazo significa que no se creó nada.
 */
export abstract class UsersRepository {
  abstract me(): Promise<CurrentUser>;
  abstract roles(): Promise<CatalogItem[]>;
  abstract create(draft: NewUser): Promise<void>;
}
