import { Schedule, ScheduleDraft } from '@domain/entities/schedule';
import { ScheduleDto, ScheduleRequest } from '../dto/schedules.dto';
import { toYmd } from './to-ymd';

/**
 * '1970-01-01T18:00:00.000Z' → '18:00'.
 *
 * Se recorta el STRING y no se construye un Date: la hora ya está en UTC por construcción
 * —el service la arma con `new Date('1970-01-01T18:00:00Z')`— y pasarla por
 * toLocaleTimeString la correría a la zona del navegador, o sea tres horas en Argentina.
 *
 * Devuelve null si no matchea, que cubre tanto el `startTime` null del schema como un
 * formato inesperado: la fila se muestra con '—' en vez de romper la lista entera.
 */
function toHhMm(raw: string | null): string | null {
  if (raw === null) return null;
  const m = /T(\d{2}:\d{2})/.exec(raw);
  return m === null ? null : m[1];
}

export function toSchedule(dto: ScheduleDto): Schedule {
  return {
    id: dto.id,
    courtId: dto.courtId,
    coachId: dto.coachId,
    categoryGroupId: dto.categoryGroupId,
    sessionTypeId: dto.sessionTypeId,
    weekday: dto.weekday,
    startTime: toHhMm(dto.startTime),
    endTime: toHhMm(dto.endTime),
    capacity: dto.capacity,
    // String() y no un cast: el DTO acepta number por la incertidumbre del Decimal.
    price: dto.price === null ? null : String(dto.price),
    active: dto.active,
    validFrom: toYmd(dto.validFrom),
    validTo: toYmd(dto.validTo),
  };
}

/**
 * `validFrom` y `validTo` se OMITEN cuando son null, porque el service convierte el null en
 * `undefined` y el valor viejo sobrevive (§3.7). `capacity` SÍ va en null: su columna lo
 * acepta y es la única forma de vaciarlo.
 *
 * NO manda `price`: el backend no declara el campo y lo rechaza con 400 (ver el comentario
 * de `ScheduleRequestSchema`). El GET sí lo devuelve, así que `toSchedule` lo sigue leyendo.
 *
 * Ojo con "unificar" esto con toPlanRequest, toStudentRequest o toClubRequest: los dos
 * primeros omiten claves distintas y por motivos distintos, y toClubRequest no omite NINGUNA
 * (club.mapper.ts:20-26) — ahí el null vacía de verdad, así que el `undefined` que resuelve
 * §3.7 acá sería el bug allá. Cada mapper tiene su test justamente para que el refactor
 * "limpio" rompa en rojo y no en producción.
 */
export function toScheduleRequest(draft: ScheduleDraft): ScheduleRequest {
  return {
    courtId: draft.courtId,
    coachId: draft.coachId,
    categoryGroupId: draft.categoryGroupId,
    sessionTypeId: draft.sessionTypeId,
    weekday: draft.weekday,
    startTime: draft.startTime,
    endTime: draft.endTime,
    capacity: draft.capacity,
    active: draft.active,
    ...(draft.validFrom !== null ? { validFrom: draft.validFrom } : {}),
    ...(draft.validTo !== null ? { validTo: draft.validTo } : {}),
  };
}
