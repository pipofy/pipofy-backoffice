import * as v from 'valibot';

/**
 * ESTE DTO VA EN camelCase, a diferencia del resto del repo. No es un descuido.
 *
 * `class-sessions.service.list()` devuelve la fila de Prisma sin transformar, y los nombres
 * de propiedad de Prisma son camelCase: `@map("court_id")` renombra la COLUMNA en la base,
 * no la propiedad en JS. `http-courts.repository.spec.ts` ya lo documenta con sus fixtures
 * (`surfaceTypeId`, `deletedAt`). Pasarlo a snake_case "por consistencia" rompe el v.parse
 * en runtime y el compilador no lo ve.
 *
 * Sólo se declaran los campos que el dashboard usa; valibot descarta el resto de la fila.
 */
export const ClassSessionDtoSchema = v.object({
  id: v.string(),
  courtId: v.string(),
  coachId: v.string(),
  categoryGroupId: v.string(),
  /** Nullable en Prisma. Una sesión sin hora no entra en la grilla (spec §7.2). */
  startAt: v.nullable(v.string()),
  /** Nullable en Prisma. El mapper lo normaliza a 0. */
  capacity: v.nullable(v.number()),
  /** Calculado por el backend: capacity − (confirmadas + held vigentes). */
  availableSpots: v.number(),
});
export const ClassSessionListDtoSchema = v.array(ClassSessionDtoSchema);
export type ClassSessionDto = v.InferOutput<typeof ClassSessionDtoSchema>;

/**
 * `GET /class-sessions/:id/waiting-list` devuelve las entradas en estado 'esperando' de UNA
 * sesión, como filas crudas de Prisma.
 *
 * Antes esto era `v.array(v.unknown())` porque el único consumidor —el dashboard— sólo usaba
 * el LARGO del array. La pantalla de reservas sí lee adentro: muestra al alumno y necesita el
 * `id` de la anotación para poder darla de baja.
 */
export const WaitingListEntryDtoSchema = v.object({
  id: v.string(),
  studentId: v.string(),
  requestedAt: v.nullable(v.string()),
});
export type WaitingListEntryDto = v.InferOutput<typeof WaitingListEntryDtoSchema>;

export const WaitingListDtoSchema = v.array(WaitingListEntryDtoSchema);

/**
 * Lo que devuelve `GET /class-sessions/:id/reservations`: filas crudas de Prisma con
 * `reservationStatus` embebido por el `include` del servicio.
 *
 * `student` también viene incluido y NO se declara: el modal ya tiene el padrón en memoria y
 * resuelve el nombre por `studentId`. valibot descarta lo que no está declarado.
 *
 * `deletedAt` SÍ se declara, por el mismo motivo que en `courts.dto.ts`: el `findMany` del
 * backend no lo filtra y el recorte se hace en el cliente.
 */
export const SessionReservationDtoSchema = v.object({
  id: v.string(),
  studentId: v.string(),
  /** Nullable en Prisma (`schema.prisma:599`): una reserva cobrada puede no tener plan. */
  studentPlanId: v.nullable(v.string()),
  holdExpiresAt: v.nullable(v.string()),
  deletedAt: v.nullable(v.string()),
  reservationStatus: v.object({ name: v.string() }),
});
export const SessionReservationListDtoSchema = v.array(SessionReservationDtoSchema);
export type SessionReservationDto = v.InferOutput<typeof SessionReservationDtoSchema>;

/**
 * Body de `DELETE /class-sessions/:id` y de `DELETE /class-sessions/day?date=`.
 *
 * `reason` es OPCIONAL y se OMITE cuando no hay: `CancelClassSessionDto` lo valida con
 * `@ValidateIf(o => o.notify === true)`, y el ValidationPipe corre con
 * `whitelist: true, forbidNonWhitelisted: true` (app.module.ts:62), así que mandar la clave
 * en null es un 400 y no "sin motivo".
 *
 * `offerToWaitingList` NO se manda NUNCA, aunque el endpoint individual lo acepte: le
 * ofrecería el lugar liberado al primero de la lista de espera DE LA CLASE QUE ACABA DE
 * CANCELARSE. `CancelDayDto` lo omite a propósito del lado del backend y explica por qué; al
 * individual se le escapó. Hasta que lo arreglen, el que no lo manda es el front.
 */
export const CancelClassRequestSchema = v.object({
  notify: v.boolean(),
  reason: v.optional(v.string()),
});
export type CancelClassRequest = v.InferOutput<typeof CancelClassRequestSchema>;

/**
 * Body de `POST /class-sessions/:id/attendance`. EXACTAMENTE esta forma y nada más: el
 * ValidationPipe global corre con `whitelist: true, forbidNonWhitelisted: true`
 * (app.module.ts), así que una clave de más es un 400 de la llamada entera.
 *
 * `status` va por NOMBRE y no por id: `AttendanceService` busca la fila de `attendance_status`
 * por `name`. No hay catálogo que pedir — `GET /catalogs/*` no expone attendance-statuses.
 */
export const AttendanceRequestSchema = v.object({
  items: v.array(
    v.object({
      reservationId: v.string(),
      status: v.picklist(['asistio', 'ausente']),
    }),
  ),
});
export type AttendanceRequest = v.InferOutput<typeof AttendanceRequestSchema>;

/**
 * Lo que devuelve ese POST: 201 —no 200: `markBulk` no declara `@HttpCode` y rige el default de
 * `@Post()` de Nest— con un array POR ÍTEM, aunque la mitad falle.
 *
 * `status` y `error` son opcionales Y nullables porque el backend manda uno o el otro según el
 * `ok`: el éxito hace push de `{reservationId, ok:true, status}` y el fallo de
 * `{reservationId, ok:false, error}`.
 *
 * `reservationId` vuelve como el string ORIGINAL del request: `markBulk` hace push de
 * `item.reservationId`, no del BigInt que parseó. No hay que re-normalizarlo.
 */
export const AttendanceResultDtoSchema = v.object({
  reservationId: v.string(),
  ok: v.boolean(),
  status: v.optional(v.nullable(v.string())),
  error: v.optional(v.nullable(v.string())),
});
export const AttendanceResultListDtoSchema = v.array(AttendanceResultDtoSchema);
export type AttendanceResultDto = v.InferOutput<typeof AttendanceResultDtoSchema>;
