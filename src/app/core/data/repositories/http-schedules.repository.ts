import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import {
  Schedule,
  ScheduleDraft,
  SessionGenerationDraft,
  SessionGenerationResult,
} from '@domain/entities/schedule';
import {
  ScheduleListDtoSchema,
  ScheduleRequestSchema,
  GenerateSessionsRequestSchema,
  GenerateSessionsResultDtoSchema,
} from '../dto/schedules.dto';
import { toSchedule, toScheduleRequest } from '../mappers/schedule.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera
 * del observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpSchedulesRepository extends SchedulesRepository {
  private readonly api = inject(ApiClient);

  async list(): Promise<Schedule[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/schedules'));
      const dtos = v.parse(ScheduleListDtoSchema, raw);
      return dtos.map(toSchedule);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: ScheduleDraft): Promise<void> {
    try {
      const body = v.parse(ScheduleRequestSchema, toScheduleRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/schedules', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: ScheduleDraft): Promise<void> {
    try {
      const body = v.parse(ScheduleRequestSchema, toScheduleRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/schedules/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/schedules/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async generateSessions(draft: SessionGenerationDraft): Promise<SessionGenerationResult> {
    try {
      const body = v.parse(GenerateSessionsRequestSchema, { from: draft.from, to: draft.to });
      const raw = await firstValueFrom(
        this.api.post<unknown>('/schedules/generate-sessions', body),
      );
      // Se parsea la respuesta porque las dos cifras se MUESTRAN: un {created: undefined}
      // silencioso terminaría como "undefined clases creadas" en el toast.
      return v.parse(GenerateSessionsResultDtoSchema, raw);
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
