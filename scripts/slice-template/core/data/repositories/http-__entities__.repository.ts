import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__, __Entity__Draft } from '@domain/entities/__entity__';
import { __Entity__ListDtoSchema, __Entity__RequestSchema } from '../dto/__entities__.dto';
import { to__Entity__, to__Entity__Request } from '../mappers/__entity__.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/** v.parse tira fuera del observable: el try/catch normaliza las dos vías. */
@Injectable()
export class Http__Entities__Repository extends __Entities__Repository {
  private readonly api = inject(ApiClient);

  async list(): Promise<__Entity__[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/__entities__'));
      return v.parse(__Entity__ListDtoSchema, raw).map(to__Entity__);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: __Entity__Draft): Promise<void> {
    try {
      const body = v.parse(__Entity__RequestSchema, to__Entity__Request(draft));
      await firstValueFrom(this.api.post<unknown>('/__entities__', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: __Entity__Draft): Promise<void> {
    try {
      const body = v.parse(__Entity__RequestSchema, to__Entity__Request(draft));
      await firstValueFrom(this.api.patch<unknown>(`/__entities__/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/__entities__/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
