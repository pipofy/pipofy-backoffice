import * as v from 'valibot';

/**
 * camelCase: la API es NestJS + Prisma y el @map de Prisma es sólo a nivel de base.
 *
 * v.object ignora las claves que no declara, así que `clubId`, `createdAt` y `updatedAt`
 * entran y se descartan sin romper el parseo — `deletedAt` incluido: el backend ya filtra
 * los borrados en su `list()`.
 */
export const CategoryGroupDtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
});
export type CategoryGroupDto = v.InferOutput<typeof CategoryGroupDtoSchema>;

export const CategoryGroupListDtoSchema = v.array(CategoryGroupDtoSchema);

/**
 * Write-path. `name` nunca es null: createCategoryGroupDraft ya garantizó que tiene
 * contenido. `CreateCategoryGroupDto` del backend sólo declara `name`, y con
 * forbidNonWhitelisted: true cualquier clave de más devuelve 400.
 */
export const CategoryGroupRequestSchema = v.object({
  name: v.string(),
});
export type CategoryGroupRequest = v.InferOutput<typeof CategoryGroupRequestSchema>;
