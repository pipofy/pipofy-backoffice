import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { SessionReservation } from '@domain/entities/session-reservation';
import { CancelClassDraft } from '@domain/entities/class-cancellation';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
} from '@domain/entities/session-attendance';
import { isOnLocalDate, localDateKey } from '@domain/local-date';
import {
  ClassSessionListDtoSchema,
  WaitingListDtoSchema,
  SessionReservationListDtoSchema,
  CancelClassRequestSchema,
  AttendanceRequestSchema,
  AttendanceResultListDtoSchema,
} from '../dto/class-session.dto';
import {
  toClassSession,
  toWaitingListEntry,
  toSessionReservation,
  toCancelClassRequest,
  toAttendanceRequest,
  toSessionAttendanceResult,
} from '../mappers/class-session.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/** 'yyyy-MM-dd' ± n días, en el calendario local. `new Date(y, m, d)` normaliza el desborde. */
function shiftDay(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera del
 * observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpClassSessionsRepository extends ClassSessionsRepository {
  private readonly api = inject(ApiClient);

  /**
   * `ClassSessionsService.list()` arma la ventana con new Date(`${from}T00:00:00Z`). La Z es
   * LITERAL: interpreta las fechas en UTC y no en la zona del club, así que pedir sólo "hoy"
   * desde Argentina pierde las clases de 21:00 a 23:59 — prime time. Se pide un día de más de
   * cada lado y se recorta acá con la fecha local exacta.
   *
   * El recorte vive en el repositorio y no en el consumidor a propósito: antes estaba repartido
   * entre `HttpDashboardRepository` (que pedía ±1 día) y `dashboard.mapper` (que filtraba), y
   * cualquier pantalla nueva tenía que acordarse de las dos mitades.
   */
  async list(dateKey: string): Promise<ClassSession[]> {
    try {
      const from = shiftDay(dateKey, -1);
      const to = shiftDay(dateKey, 1);
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions?from=${from}&to=${to}`),
      );
      return v
        .parse(ClassSessionListDtoSchema, raw)
        .filter((dto) => isOnLocalDate(dto.startAt, dateKey))
        .map(toClassSession);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async reservations(sessionId: string): Promise<SessionReservation[]> {
    try {
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions/${sessionId}/reservations`),
      );
      return (
        v
          .parse(SessionReservationListDtoSchema, raw)
          // El backend no filtra deletedAt en ningún list(); mismo recorte que el resto de los
          // repositorios.
          .filter((dto) => dto.deletedAt === null)
          .map(toSessionReservation)
      );
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Responde 201, no 200: `markBulk` no declara `@HttpCode` y rige el default de `@Post()` de
   * Nest. `HttpClient` lo trata como éxito igual.
   *
   * NO es atómico: `markBulk` itera y hace un upsert por ítem, cada uno con su propio try. Si
   * el ítem 3 de 10 falla, los dos primeros ya están escritos. Reintentar es seguro —el upsert
   * es idempotente y no toca créditos, cupo ni el estado de la reserva—, pero nadie debe
   * asumir un todo-o-nada que no existe.
   */
  async markAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]> {
    try {
      const body = v.parse(AttendanceRequestSchema, toAttendanceRequest(marks));
      const raw = await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${sessionId}/attendance`, body),
      );
      return v.parse(AttendanceResultListDtoSchema, raw).map(toSessionAttendanceResult);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async waitingList(sessionId: string): Promise<WaitingListEntry[]> {
    try {
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions/${sessionId}/waiting-list`),
      );
      return v.parse(WaitingListDtoSchema, raw).map(toWaitingListEntry);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async joinWaitingList(sessionId: string, studentId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${sessionId}/waiting-list`, { studentId }),
      );
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async leaveWaitingList(entryId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/waiting-list/${entryId}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * La respuesta —`{ cancelled: true }`— se DESCARTA: no dice nada que la relectura de la
   * lista no diga mejor. Mismo criterio que `purchasePlan`.
   */
  async cancel(sessionId: string, draft: CancelClassDraft): Promise<void> {
    try {
      const body = v.parse(CancelClassRequestSchema, toCancelClassRequest(draft));
      await firstValueFrom(this.api.delete<unknown>(`/class-sessions/${sessionId}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * `date` va como QUERY y no en el path: el backend declara `DELETE /class-sessions/day` con
   * `@Query() CancelDayQueryDto`, y la ruta está declarada ANTES de `@Delete(':id')` justo
   * para que "day" no se enrute como un id.
   *
   * `dateKey` es la fecha LOCAL, la misma que `list()`: `cancelDay()` arma su ventana con
   * `new Date(`${date}T00:00:00-03:00`)`, así que acá no hace falta el ±1 día que sí necesita
   * la lectura (esa pide en UTC).
   *
   * La respuesta trae `affectedCount` y también se descarta: la pantalla no lo muestra
   * todavía. `markAttendance` es la única escritura de este repositorio que SÍ devuelve algo, y
   * por un motivo que acá no aplica: su resultado por ítem no se puede releer de ningún lado.
   */
  async cancelDay(dateKey: string, draft: CancelClassDraft): Promise<void> {
    try {
      const body = v.parse(CancelClassRequestSchema, toCancelClassRequest(draft));
      await firstValueFrom(this.api.delete<unknown>(`/class-sessions/day?date=${dateKey}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
