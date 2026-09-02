import { Coach, CoachDraft } from '../entities/coach';

/**
 * Sin create: crear un profesor es crear un USUARIO (`POST /users` con rol 'profesor'), y no
 * existe `POST /coaches`. Meterlo acá haría creer lo contrario — la asimetría es del backend
 * y conviene que se vea. Ver `UsersRepository.create()`.
 *
 * `update()` escribe sólo `description`, que es lo único que el backend toca.
 */
export abstract class CoachesRepository {
  abstract list(): Promise<Coach[]>;
  /** Sólo `description`: es lo único que el backend escribe (§3.10). */
  abstract update(id: string, draft: CoachDraft): Promise<void>;
}
