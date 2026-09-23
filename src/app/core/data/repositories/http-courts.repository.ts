import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { Court, CourtDraft } from '@domain/entities/court';
import { CourtListDtoSchema, CourtRequestSchema } from '../dto/courts.dto';
import { toCourt, toCourtRequest } from '../mappers/court.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera
 * del observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpCourtsRepository extends CourtsRepository {
  private readonly api = inject(ApiClient);

  async list(): Promise<Court[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/courts'));
      const dtos = v.parse(CourtListDtoSchema, raw);
      return dtos.map(toCourt);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: CourtDraft): Promise<void> {
    try {
      const body = v.parse(CourtRequestSchema, toCourtRequest(draft, 'alta'));
      await firstValueFrom(this.api.post<unknown>('/courts', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: CourtDraft): Promise<void> {
    try {
      const body = v.parse(CourtRequestSchema, toCourtRequest(draft, 'edicion'));
      await firstValueFrom(this.api.patch<unknown>(`/courts/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/courts/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
