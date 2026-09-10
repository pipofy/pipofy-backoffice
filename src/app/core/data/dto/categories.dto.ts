import * as v from 'valibot';

export const CategoryDtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  levelOrder: v.nullable(v.number()),
});
export type CategoryDto = v.InferOutput<typeof CategoryDtoSchema>;

export const CategoryListDtoSchema = v.array(CategoryDtoSchema);

/**
 * `levelOrder` va NULLABLE y no optional, al revés que los FK de canchas: es un Int? que
 * categories.service.ts pasa derecho a Prisma sin BigInt(), así que el null no rompe nada.
 * Y hace falta mandarlo: omitir la clave le da `undefined` a Prisma, que significa "no
 * toques el campo" — el usuario borraría el orden y el viejo seguiría ahí.
 */
export const CategoryRequestSchema = v.object({
  name: v.string(),
  levelOrder: v.nullable(v.number()),
});
export type CategoryRequest = v.InferOutput<typeof CategoryRequestSchema>;
