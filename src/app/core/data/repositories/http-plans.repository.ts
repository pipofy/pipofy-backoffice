import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { Plan, PlanDraft } from '@domain/entities/plan';
import { PlanListDtoSchema, PlanRequestSchema } from '../dto/plans.dto';
import { toPlan, toPlanRequest } from '../mappers/plan.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ignoringStatus } from '../http/ignoring-status';
import { ApiClient } from '../http/api-client';
import { API_CONFIG } from '../config/api-config.token';

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera
 * del observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpPlansRepository extends PlansRepository {
  private readonly api = inject(ApiClient);

  /**
   * `HttpClient` directo y NO `ApiClient` para los dos métodos de categorías: `ApiClient`
   * normaliza a `DomainError` en su `catchError`, y ahí un 409 y un 400 llegan los dos como
   * `{kind:'domain'}` — indistinguibles, justo lo que estos métodos necesitan distinguir.
   *
   * Es el mismo movimiento y el mismo motivo que documenta `http-category-groups.repository.ts`:
   * el significado de un código HTTP depende del endpoint, así que el mapeo específico vive en
   * el repositorio y `to-domain-error.ts` no se toca.
   */
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_CONFIG).apiBaseUrl;

  async list(): Promise<Plan[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/plans'));
      const dtos = v.parse(PlanListDtoSchema, raw);
      // ponytail: el filtro de borrados es del cliente porque plans.service.list() no
      // excluye deletedAt. Techo: con muchos planes borrados se transfieren filas de más.
      // Salida real: arreglarlo en el backend.
      return dtos.filter((d) => d.deletedAt === null).map(toPlan);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: PlanDraft): Promise<void> {
    try {
      const body = v.parse(PlanRequestSchema, toPlanRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/plans', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: PlanDraft): Promise<void> {
    try {
      const body = v.parse(PlanRequestSchema, toPlanRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/plans/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/plans/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /** 409 = 'La categoría ya está asociada al plan'. Ver el contrato: es éxito, no error. */
  addCategory(planId: string, categoryId: string): Promise<void> {
    return ignoringStatus(
      409,
      firstValueFrom(this.http.post(`${this.baseUrl}/plans/${planId}/categories`, { categoryId })),
    );
  }

  /** 404 = 'La categoría no está asociada al plan'. Idem: el estado final es el pedido. */
  removeCategory(planId: string, categoryId: string): Promise<void> {
    return ignoringStatus(
      404,
      firstValueFrom(this.http.delete(`${this.baseUrl}/plans/${planId}/categories/${categoryId}`)),
    );
  }
}
