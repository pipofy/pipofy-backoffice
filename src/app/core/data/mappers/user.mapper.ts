import { NewUser } from '@domain/entities/new-user';
import { CurrentUser } from '@domain/entities/current-user';
import { CreateUserRequest, CurrentUserDto } from '../dto/users.dto';

/**
 * `nombre` y `apellido` se OMITEN cuando son null en vez de mandarse en null. `@IsOptional()`
 * de class-validator los dejaría pasar igual, pero omitir no depende de ese detalle del repo
 * de la API.
 *
 * OJO: la forma coincide con `toCourtRequest` pero la razón NO es la misma — allá omitir
 * evita un `BigInt(null)` que devuelve 500. No unificarlas.
 */
export function toCreateUserRequest(draft: NewUser): CreateUserRequest {
  return {
    email: draft.email,
    roleId: draft.roleId,
    ...(draft.nombre !== null ? { nombre: draft.nombre } : {}),
    ...(draft.apellido !== null ? { apellido: draft.apellido } : {}),
  };
}

/**
 * Nombre y apellido en ese orden (no "Pérez, Ana" como studentDisplayName): es un saludo al
 * usuario logueado, no una fila que se ordena por apellido. '' cuando no hay nada: mostrar un
 * renglón vacío es peor que no mostrarlo.
 */
export function toCurrentUser(dto: CurrentUserDto): CurrentUser {
  const parts = [dto.nombre, dto.apellido].filter((p): p is string => !!p && p.trim() !== '');
  const displayName = parts.length > 0 ? parts.join(' ') : (dto.email?.trim() ?? '');
  return { id: dto.id, email: dto.email, displayName };
}
