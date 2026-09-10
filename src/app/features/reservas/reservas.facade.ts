import { Injectable, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
import { CancelClassInput, createCancelClassDraft } from '@domain/entities/class-cancellation';
import { DomainError } from '@domain/errors';
import { localDateKey } from '@domain/local-date';
import { toDomainError } from '@data/http/to-domain-error';

/**
 * Las clases de UNA fecha. La fecha es estado de la facade y no de la página para que
 * volver a /reservas después de abrir otra pantalla no te devuelva a hoy.
 */
@Injectable()
export class ReservasFacade extends SignalStore<ClassSession[], DomainError> {
  private readonly repo = inject(ClassSessionsRepository);

  private readonly _date = signal(localDateKey(new Date()));
  readonly date = this._date.asReadonly();

  /**
   * `class-sessions.service.list()` no tiene ORDER BY: sin esto la tabla sale en el orden
   * físico del heap de Postgres. Se ordena por el ISO crudo, que es lexicográficamente
   * ordenable; las sesiones sin hora caen primero y son visiblemente raras, que es lo correcto.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  });

  load(): Promise<void> {
    return this.run(this.repo.list(this._date()), toDomainError);
  }

  setDate(dateKey: string): Promise<void> {
    this._date.set(dateKey);
    return this.load();
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * `createCancelClassDraft` tira de forma síncrona cuando se pide avisar sin motivo; va
   * DENTRO de la promesa para que run()/toDomainError normalicen la invariante de dominio y
   * el fallo del repo por la misma vía. Mismo patrón que AlumnosFacade.create().
   *
   * Re-lee la lista en vez de parchear: la cancelación mueve el cupo de la clase (todas sus
   * reservas pasan a 'cancelled') y eso lo calcula el backend. El estado cancelado también
   * vuelve en esa relectura (`classSessionStatus`), así que no hay nada que marcar en memoria.
   */
  cancelarClase(sessionId: string, input: CancelClassInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.cancel(sessionId, createCancelClassDraft(input)))
        .then(() => this.repo.list(this._date())),
      toDomainError,
    );
  }

  cancelarDia(input: CancelClassInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.cancelDay(this._date(), createCancelClassDraft(input)))
        .then(() => this.repo.list(this._date())),
      toDomainError,
    );
  }
}
