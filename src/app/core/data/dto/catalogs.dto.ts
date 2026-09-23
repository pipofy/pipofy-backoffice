import * as v from 'valibot';

/** `catalogs.controller.ts` ya devuelve exactamente { id, name }, ambos string: es el único
 *  endpoint del backend que serializa a mano en vez de devolver la fila cruda de Prisma. */
export const CatalogItemDtoSchema = v.object({
  id: v.string(),
  name: v.string(),
});
export const CatalogListDtoSchema = v.array(CatalogItemDtoSchema);
export type CatalogItemDto = v.InferOutput<typeof CatalogItemDtoSchema>;
