import { CatalogItem } from '../entities/catalog-item';

/**
 * Los catálogos los siembra `prisma:seed` y no cambian en runtime. Clase abstracta a propósito:
 * hace de token DI sin arrastrar @angular/core al dominio. Cachear o no es decisión de la
 * implementación (HttpCatalogsRepository memoiza la promesa por sesión).
 */
export abstract class CatalogsRepository {
  abstract surfaceTypes(): Promise<CatalogItem[]>;
  abstract courtStatuses(): Promise<CatalogItem[]>;
  abstract planTypes(): Promise<CatalogItem[]>;
  abstract sessionTypes(): Promise<CatalogItem[]>;
  abstract paymentMethods(): Promise<CatalogItem[]>;
  /** 'active', 'pending_classification', 'inactive' (prisma/seed.ts:6). */
  abstract studentStatuses(): Promise<CatalogItem[]>;
}
