import { Injectable, computed, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__, __Entity__Input, create__Entity__Draft } from '@domain/entities/__entity__';
import { DomainError, asDomainError } from '@domain/errors';

@Injectable()
export class __Feature__Facade extends SignalStore<__Entity__[], DomainError> {
  private readonly repo = inject(__Entities__Repository);

  readonly sorted = computed(() => [...(this.data() ?? [])].sort((a, b) => a.name.localeCompare(b.name)));

  load(): Promise<void> {
    return this.run(this.repo.list(), asDomainError);
  }

  clearError(): void {
    this.setError(null);
  }

  /** create__Entity__Draft tira síncrono: va DENTRO de la promesa para que run() lo normalice. */
  create(input: __Entity__Input): Promise<void> {
    return this.run(
      Promise.resolve().then(() => this.repo.create(create__Entity__Draft(input))).then(() => this.repo.list()),
      asDomainError,
    );
  }

  update(id: string, input: __Entity__Input): Promise<void> {
    return this.run(
      Promise.resolve().then(() => this.repo.update(id, create__Entity__Draft(input))).then(() => this.repo.list()),
      asDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(this.repo.remove(id).then(() => this.repo.list()), asDomainError);
  }
}
