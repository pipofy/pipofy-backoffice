import * as v from 'valibot';

/**
 * `startTime`/`endTime` llegan como DateTime completo aunque la columna sea @db.Time, y
 * `validFrom`/`validTo` igual aunque sean @db.Date (§3.2): acá se declaran como string
 * crudo y el mapper los recorta.
 *
 * `price` acepta string|number por el mismo motivo que en Planes: Prisma serializa Decimal
 * vía decimal.js, cuyo toJSON devuelve string, pero no se verificó con el servidor
 * levantado. El mapper normaliza a string.
 */
export const ScheduleDtoSchema = v.object({
  id: v.string(),
  courtId: v.string(),
  coachId: v.string(),
  categoryGroupId: v.string(),
  sessionTypeId: v.string(),
  weekday: v.nullable(v.number()),
  startTime: v.nullable(v.string()),
  endTime: v.nullable(v.string()),
  capacity: v.nullable(v.number()),
  price: v.nullable(v.union([v.string(), v.number()])),
  active: v.boolean(),
  validFrom: v.nullable(v.string()),
  validTo: v.nullable(v.string()),
});
export type ScheduleDto = v.InferOutput<typeof ScheduleDtoSchema>;

export const ScheduleListDtoSchema = v.array(ScheduleDtoSchema);

/**
 * Write-path, UNO SOLO para POST y PATCH: `UpdateScheduleDto` reexporta `CreateScheduleDto`,
 * así que en el PATCH todo lo obligatorio sigue siendo obligatorio. Mismo caso que Planes.
 *
 * SIN `price`, y no es un olvido: `CreateScheduleDto` del backend NO declara el campo y el
 * ValidationPipe corre con `forbidNonWhitelisted`, así que mandarlo devuelve
 * `400 "property price should not exist"` y NO se puede crear ni editar un horario.
 * Verificado contra el server: el mismo body sin price da 201. La columna existe y el GET la
 * devuelve —por eso `ScheduleDtoSchema` sí la declara—, pero hoy es de sólo lectura.
 * Cuando el backend acepte `price`, vuelve acá y a `toScheduleRequest`.
 *
 * Dos formas distintas de "sin valor", y cada una tiene su motivo:
 *   · `capacity` va EN null — su columna es nullable y el service lo pasa crudo a Prisma,
 *     así que null lo vacía.
 *   · `validFrom` y `validTo` se OMITEN — el service hace `dto.validFrom ? ... : undefined`
 *     y convierte el null en "no toques" (§3.7). Mandarlos en null no los borraría, sólo
 *     agrandaría el body.
 *   · el resto es obligatorio y siempre viaja.
 *
 * `weekday` y `capacity` como number: el ValidationPipe corre sin transform (§3.3).
 */
export const ScheduleRequestSchema = v.object({
  courtId: v.string(),
  coachId: v.string(),
  categoryGroupId: v.string(),
  sessionTypeId: v.string(),
  weekday: v.number(),
  startTime: v.string(),
  endTime: v.string(),
  capacity: v.nullable(v.number()),
  active: v.boolean(),
  validFrom: v.optional(v.string()),
  validTo: v.optional(v.string()),
});
export type ScheduleRequest = v.InferOutput<typeof ScheduleRequestSchema>;

/** Lo que devuelve POST /schedules/generate-sessions. */
export const GenerateSessionsResultDtoSchema = v.object({
  created: v.number(),
  skipped: v.number(),
});

/** Dos 'YYYY-MM-DD'. @IsDateString() los acepta así. */
export const GenerateSessionsRequestSchema = v.object({
  from: v.string(),
  to: v.string(),
});
export type GenerateSessionsRequest = v.InferOutput<typeof GenerateSessionsRequestSchema>;
