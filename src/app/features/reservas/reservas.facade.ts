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
   * Las clases que se cancelaron EN ESTA SESIÓN del navegador.
   *
   * ponytail: la fuente de verdad debería ser la fila. `GET /class-sessions` devuelve
   * `classSessionStatusId` pero no existe `GET /catalogs/class-session-statuses`, así que el
   * front no puede traducir ese id a 'cancelada' sin inventarse el número. Techo: un F5
   * vuelve a mostrar las canceladas como si estuvieran programadas. Salida: ese endpoint del
   * catálogo — con él el estado sale del DTO, la lista lo muestra siempre y este Set se borra.
   *
   * No se limpia al cambiar de fecha: los ids son únicos, y volver a un día ya cancelado
   * tiene que seguir mostrándolo cancelado.
   */
  private readonly _cancelled = signal<ReadonlySet<string>>(new Set());
  readonly cancelled = this._cancelled.asReadonly();

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
   * reservas pasan a 'cancelled') y eso lo calcula el backend.
   */
  cancelarClase(sessionId: string, input: CancelClassInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.cancel(sessionId, createCancelClassDraft(input)))
        .then(() => this.marcarCancelada([sessionId]))
        .then(() => this.repo.list(this._date())),
      toDomainError,
    );
  }

  /**
   * Los ids se capturan ANTES de cancelar: después de la relectura son las mismas filas, pero
   * capturarlos antes deja explícito que se marca lo que se vio, no lo que volvió.
   *
   * Marca TODAS las de la fecha porque `cancelDay()` cancela todas las 'programada' del día, y
   * 'completada' no lo escribe ningún flujo del backend: lo que no estaba cancelado, quedó.
   */
  cancelarDia(input: CancelClassInput): Promise<void> {
    const ids = (this.data() ?? []).map((s) => s.id);
    return this.run(
      Promise.resolve()
        .then(() => this.repo.cancelDay(this._date(), createCancelClassDraft(input)))
        .then(() => this.marcarCancelada(ids))
        .then(() => this.repo.list(this._date())),
      toDomainError,
    );
  }

  private marcarCancelada(ids: readonly string[]): void {
    this._cancelled.update((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  /** Ver AlumnosFacade.reset(): SignalStore no conoce el estado propio de la facade. */
  override reset(): void {
    super.reset();
    this._cancelled.set(new Set());
  }
}
