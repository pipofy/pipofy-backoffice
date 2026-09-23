import * as v from 'valibot';

/**
 * camelCase: la API es NestJS + Prisma y el @map de Prisma es sólo a nivel de base (§4.1).
 *
 * v.object ignora las claves que no declara, así que `clubId`, `createdAt` y `updatedAt`
 * entran y se descartan sin romper el parseo — `deletedAt` incluido: el backend ya filtra
 * los borrados en su `list()` (§4.3).
 */
export const CourtDtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  code: v.nullable(v.string()),
  surfaceTypeId: v.nullable(v.string()),
  indoor: v.nullable(v.boolean()),
  courtStatusId: v.nullable(v.string()),
});
export type CourtDto = v.InferOutput<typeof CourtDtoSchema>;

export const CourtListDtoSchema = v.array(CourtDtoSchema);

/**
 * Write-path. Los FK son nullish: EN null al editar (única forma de vaciarlos, el update
 * pasa por fkOpcional) y AUSENTES en el alta, donde el create hace BigInt(null) → 500
 * (§4.5).
 *
 * `code` sí acepta null: Prisma lo setea en null, que es la única forma de limpiarlo.
 * `name` nunca es null — createCourtDraft ya garantizó que tiene contenido.
 *
 * Que la clave quede ausente o en `undefined` es indistinto: HttpClient serializa con
 * JSON.stringify, que descarta las claves con valor undefined.
 */
export const CourtRequestSchema = v.object({
  name: v.string(),
  code: v.nullable(v.string()),
  surfaceTypeId: v.nullish(v.string()),
  indoor: v.boolean(),
  courtStatusId: v.nullish(v.string()),
});
export type CourtRequest = v.InferOutput<typeof CourtRequestSchema>;
