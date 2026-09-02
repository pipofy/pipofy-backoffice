import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { NewUser } from '@domain/entities/new-user';
import { ApiClient } from '../http/api-client';
import { toDomainError } from '../http/to-domain-error';
import { CatalogItem, CatalogListDtoSchema } from '../dto/catalogs.dto';
import { CreateUserRequestSchema, CurrentUserDto, CurrentUserDtoSchema } from '../dto/users.dto';
import { toCreateUserRequest } from '../mappers/user.mapper';

/**
 * El usuario logueado, los roles del club y el alta de usuarios. Sin contrato abstracto en
 * `domain`, mismo criterio que CatalogsRepository: no hay dos implementaciones ni las va a
 * haber, así que los consumidores lo inyectan como clase concreta.
 *
 * SIN cache, a diferencia de CatalogsRepository: memoizar `me()` acá sería un bug de
 * identidad — un logout seguido de un login en la misma pestaña mostraría el nombre del
 * usuario anterior. Para `me()` no hace falta ninguna invalidación porque su único
 * consumidor es ShellComponent, que se destruye al salir del shell y pide de nuevo al volver
 * a entrar: una request por sesión, sin estado que limpiar. `roles()` y `create()` —que
 * además consume `ProfesoresFacade`— no cachean nada, así que ese razonamiento no aplica
 * y tampoco hace falta: no hay estado que invalidar.
 */
@Injectable()
export class UsersRepository {
  private readonly api = inject(ApiClient);

  async me(): Promise<CurrentUserDto> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/users/me'));
      return v.parse(CurrentUserDtoSchema, raw);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Los roles del club. `roles.service.list()` serializa a mano `{ id, name }` —la misma
   * forma que `/catalogs/*`—, así que reusa `CatalogListDtoSchema` en vez de declarar uno.
   *
   * SIN cache, igual que me() y a diferencia de CatalogsRepository: los roles son DEL CLUB
   * del JWT. Memoizarlos en un singleton de root haría que un logout seguido de un login con
   * otro club en la misma pestaña sirviera los roles del club anterior (§3.4).
   */
  async roles(): Promise<CatalogItem[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/roles'));
      return v.parse(CatalogListDtoSchema, raw);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Alta de usuario. Devuelve void y el llamador relee: la respuesta real es `{ id, email }`
   * y no alcanza para armar un `Coach` (le falta `description`).
   *
   * OJO (§3.2): el backend NO es atómico. `createUser` crea user + userRole + coachProfile
   * sin transacción y recién después manda el mail, sin catch. Un fallo de SMTP devuelve 500
   * con el usuario YA creado. Por eso `ProfesoresFacade.crear()` relee también cuando esto
   * tira — no asumir acá que un rechazo significa que no se creó nada.
   */
  async create(draft: NewUser): Promise<void> {
    try {
      const body = v.parse(CreateUserRequestSchema, toCreateUserRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/users', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
