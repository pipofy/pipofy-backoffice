import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Coach, CoachDraft } from '@domain/entities/coach';
import { CoachListDtoSchema, CoachRequestSchema } from '../dto/coaches.dto';
import { toCoach, toCoachRequest } from '../mappers/coach.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/**
 * /coaches no tiene POST ni DELETE. Su único PATCH edita `description` — nombre y email
 * viven en User y no tienen endpoint (§3.10). Ver CoachesRepository por qué.
 */
@Injectable()
export class HttpCoachesRepository extends CoachesRepository {
  private readonly api = inject(ApiClient);

  async list(): Promise<Coach[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/coaches'));
      const dtos = v.parse(CoachListDtoSchema, raw);
      return dtos.map(toCoach);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: CoachDraft): Promise<void> {
    try {
      const body = v.parse(CoachRequestSchema, toCoachRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/coaches/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
