import * as v from 'valibot';

/**
 * `startTime`/`endTime` llegan como DateTime completo aunque la columna sea @db.Time, y
 * `validFrom`/`validTo` igual aunque sean @db.Date (§3.2): acá se declaran como string
 * crudo y el mapper los recorta.
 *
 * SIN `price`: la columna existe en la base, pero el panel dejó de mostrarla y el backend
 * tampoco acepta el campo al escribir (ver `ScheduleRequestSchema`). v.object descarta la
 * clave que igual sigue viniendo en la respuesta.
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
  active: v.boolean(),
  validFrom: v.nullable(v.string()),
  validTo: v.nullable(v.string()),
});
export type ScheduleDto = v.InferOutput<typeof ScheduleDtoSchema>;

export const ScheduleListDtoSchema = v.array(ScheduleDtoSchema);

/**
 * Write-path, UNO SOLO para POST y PATCH: `UpdateScheduleDto` reexporta `CreateScheduleDto`,
 * así que en el PATCH TODO lo obligatorio sigue siendo obligatorio. No hay updates parciales:
 * hacer opcional un `weekday` o un `startTime` para "editar sólo un campo" devuelve 400.
 *
 * SIN `price`: el backend no declara el campo y el pipe corre con forbidNonWhitelisted, así que
 * mandarlo es `400 "property price should not exist"`. Verificado contra el server.
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
