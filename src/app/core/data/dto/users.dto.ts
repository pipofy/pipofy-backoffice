import * as v from 'valibot';

/**
 * `GET /users/me`. `users.service.me()` serializa a mano (no devuelve la fila cruda de
 * Prisma), así que los BigInt ya vienen como string.
 *
 * Los TRES datos del nombre son nullable en el schema (`User.email/nombre/apellido` son
 * `String?`, schema.prisma:72-75): un usuario creado por `POST /users` sí los tiene, pero
 * los del signup viejo pueden no tenerlos. Por eso `toCurrentUser()` (user.mapper.ts) tiene
 * cadena de fallback y no un `!`.
 *
 * `clubId` y `roles` viajan pero NO se leen: los dos ya salen del JWT (local-storage-session-store.ts),
 * que los tiene sin pagar una request y sin quedarse en blanco mientras carga. Se declaran
 * igual porque están en la respuesta y el schema documenta el borde real.
 */
export const CurrentUserDtoSchema = v.object({
  id: v.string(),
  clubId: v.string(),
  email: v.nullable(v.string()),
  nombre: v.nullable(v.string()),
  apellido: v.nullable(v.string()),
  roles: v.array(v.string()),
});
export type CurrentUserDto = v.InferOutput<typeof CurrentUserDtoSchema>;

/**
 * Write-path de `POST /users`.
 *
 * SIN `clubId`: el backend lo resuelve del JWT. Mandarlo activaría la comparación de
 * `ClubScopeGuard`, que hoy pasa de largo justamente porque el body no lo lleva (§4.2).
 *
 * `nombre` y `apellido` son `v.optional` y no `v.nullable`: el mapper OMITE la clave cuando
 * no hay valor, así no se depende del manejo de null de `@IsOptional()` del otro repo.
 */
export const CreateUserRequestSchema = v.object({
  email: v.string(),
  nombre: v.optional(v.string()),
  apellido: v.optional(v.string()),
  roleId: v.string(),
});
export type CreateUserRequest = v.InferOutput<typeof CreateUserRequestSchema>;
