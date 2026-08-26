import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ApiClient } from '../http/api-client';
import { toDomainError } from '../http/to-domain-error';
import { CurrentUserDto, CurrentUserDtoSchema } from '../dto/users.dto';

/**
 * El usuario logueado. Sin contrato abstracto en `domain`, mismo criterio que
 * CatalogsRepository: no hay dos implementaciones ni las va a haber, y el único consumidor
 * lo inyecta como clase concreta.
 *
 * SIN cache, a diferencia de CatalogsRepository: memoizar acá sería un bug de identidad —
 * un logout seguido de un login en la misma pestaña mostraría el nombre del usuario
 * anterior. No hace falta ninguna invalidación porque el único consumidor es ShellComponent,
 * que se destruye al salir del shell y pide de nuevo al volver a entrar: una request por
 * sesión, sin estado que limpiar.
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
}
