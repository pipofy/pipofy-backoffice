import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ApiClient } from '../http/api-client';
import { toDomainError } from '../http/to-domain-error';
import { CatalogItem, CatalogListDtoSchema } from '../dto/catalogs.dto';

type CatalogName =
  | 'surface-types'
  | 'court-statuses'
  | 'plan-types'
  | 'session-types'
  | 'payment-methods'
  | 'student-statuses';

/**
 * Los catálogos los siembra `prisma:seed` y no cambian en runtime, así que se piden
 * una vez por sesión y se memoiza la promesa.
 *
 * Vive en `data` y no en una feature porque lo consumen Configuración y el dashboard, y
 * `features/*` no puede importar de otra feature (boundaries). Es un repositorio y siempre
 * lo fue: hace HTTP y valida el borde con valibot.
 *
 * Sin contrato abstracto en `domain`: no hay dos implementaciones ni las va a haber, y el
 * resto de la app lo consume como clase concreta desde hace tres slices.
 *
 * Se memoiza la PROMESA y no el resultado para que dos componentes que arrancan a la vez
 * compartan una sola request. En el error se borra la entrada: si no, un corte de red deja
 * el catálogo roto hasta recargar la página.
 */
@Injectable()
export class CatalogsRepository {
  private readonly api = inject(ApiClient);
  private readonly cache = new Map<CatalogName, Promise<CatalogItem[]>>();

  surfaceTypes(): Promise<CatalogItem[]> { return this.get('surface-types'); }
  courtStatuses(): Promise<CatalogItem[]> { return this.get('court-statuses'); }
  planTypes(): Promise<CatalogItem[]> { return this.get('plan-types'); }
  sessionTypes(): Promise<CatalogItem[]> { return this.get('session-types'); }

  paymentMethods(): Promise<CatalogItem[]> { return this.get('payment-methods'); }

  /** Los estados del alumno: 'active', 'pending_classification', 'inactive' (prisma/seed.ts:6). */
  studentStatuses(): Promise<CatalogItem[]> { return this.get('student-statuses'); }

  private get(name: CatalogName): Promise<CatalogItem[]> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const pending = firstValueFrom(this.api.get<unknown>(`/catalogs/${name}`))
      .then((raw) => v.parse(CatalogListDtoSchema, raw))
      .catch((err) => {
        this.cache.delete(name);
        throw toDomainError(err);
      });

    this.cache.set(name, pending);
    return pending;
  }
}
