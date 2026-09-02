import { NewUser } from '@domain/entities/new-user';
import { CreateUserRequest } from '../dto/users.dto';

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
