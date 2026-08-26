import { ClassSession } from '@domain/entities/class-session';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { SessionReservation } from '@domain/entities/session-reservation';
import { CancelClassDraft } from '@domain/entities/class-cancellation';
import {
  ClassSessionDto,
  WaitingListEntryDto,
  SessionReservationDto,
  CancelClassRequest,
} from '../dto/class-session.dto';

export function toClassSession(dto: ClassSessionDto): ClassSession {
  return {
    id: dto.id,
    courtId: dto.courtId,
    coachId: dto.coachId,
    categoryGroupId: dto.categoryGroupId,
    startAt: dto.startAt,
    // Nullable en Prisma; normalizado acá para que ninguna pantalla tenga que decidirlo.
    capacity: dto.capacity ?? 0,
    availableSpots: dto.availableSpots,
  };
}

export function toWaitingListEntry(dto: WaitingListEntryDto): WaitingListEntry {
  return { id: dto.id, studentId: dto.studentId, requestedAt: dto.requestedAt };
}

export function toSessionReservation(dto: SessionReservationDto): SessionReservation {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentPlanId: dto.studentPlanId,
    // Se aplana acá: la entidad no tiene por qué saber que el backend lo manda embebido.
    status: dto.reservationStatus.name,
    holdExpiresAt: dto.holdExpiresAt,
  };
}

/** `reason` se omite cuando es null; ver el schema por qué mandarlo en null es un 400. */
export function toCancelClassRequest(draft: CancelClassDraft): CancelClassRequest {
  return {
    notify: draft.notify,
    ...(draft.reason !== null ? { reason: draft.reason } : {}),
  };
}
