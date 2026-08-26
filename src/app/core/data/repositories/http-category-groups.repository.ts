import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { CategoryGroup, CategoryGroupDraft } from '@domain/entities/category-group';
import { CategoryGroupListDtoSchema, CategoryGroupRequestSchema } from '../dto/category-groups.dto';
import { toCategoryGroup, toCategoryGroupRequest } from '../mappers/category-group.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ignoringStatus } from '../http/ignoring-status';
import { ApiClient } from '../http/api-client';
import { API_CONFIG } from '../config/api-config.token';

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera
 * del observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpCategoryGroupsRepository extends CategoryGroupsRepository {
  private readonly api = inject(ApiClient);

  /**
   * `HttpClient` directo y NO `ApiClient` para los dos métodos de items: `ApiClient` normaliza
   * a `DomainError` en su `catchError`, y ahí un 409 y un 400 llegan los dos como
   * `{kind:'domain'}` — indistinguibles, justo lo que estos métodos necesitan distinguir.
   *
   * Es el mismo movimiento y el mismo motivo que documenta `http-auth.repository.ts`: el
   * significado de un código HTTP depende del endpoint, así que el mapeo específico vive en el
   * repositorio y `to-domain-error.ts` no se toca.
   */
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_CONFIG).apiBaseUrl;

  async list(): Promise<CategoryGroup[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/category-groups'));
      const dtos = v.parse(CategoryGroupListDtoSchema, raw);
      // ponytail: el filtro de borrados es del cliente porque category-groups.service.list()
      // no excluye deletedAt. Techo: con muchos grupos borrados se transfieren filas de más.
      // Salida real: arreglarlo en el backend.
      return dtos.filter((d) => d.deletedAt === null).map(toCategoryGroup);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: CategoryGroupDraft): Promise<void> {
    try {
      const body = v.parse(CategoryGroupRequestSchema, toCategoryGroupRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/category-groups', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: CategoryGroupDraft): Promise<void> {
    try {
      const body = v.parse(CategoryGroupRequestSchema, toCategoryGroupRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/category-groups/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/category-groups/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /** 409 = 'La categoría ya está en el grupo'. Ver el contrato: es éxito, no error. */
  addItem(groupId: string, categoryId: string): Promise<void> {
    return ignoringStatus(
      409,
      firstValueFrom(this.http.post(`${this.baseUrl}/category-groups/${groupId}/items`, { categoryId })),
    );
  }

  /** 404 = 'La categoría no está en el grupo'. Idem: el estado final es el pedido. */
  removeItem(groupId: string, categoryId: string): Promise<void> {
    return ignoringStatus(
      404,
      firstValueFrom(this.http.delete(`${this.baseUrl}/category-groups/${groupId}/items/${categoryId}`)),
    );
  }
}
