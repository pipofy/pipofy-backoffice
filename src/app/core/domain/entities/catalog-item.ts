/** Un ítem de `/catalogs/*` y de `/roles`: el seed los serializa como { id, name }. */
export interface CatalogItem {
  readonly id: string;
  readonly name: string;
}
