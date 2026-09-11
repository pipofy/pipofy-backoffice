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
 * Sólo se declaran los campos que ALGÚN consumidor usa (dashboard, `/reservas`, `/grupos`);
 * valibot descarta el resto de la fila.
 */
export const ClassSessionDtoSchema = v.object({
  id: v.string(),
  /**
   * Nullable en Prisma: una clase creada a mano no cuelga de ninguna plantilla.
   *
   * `class-sessions.service.list()` hace `...session` sobre la fila cruda, así que este campo
   * SIEMPRE viajó — como `waitingCount` y `classSessionStatus` antes del 2026-09-10. No estaba
   * declarado, y valibot descarta lo que no se declara.
   */
  scheduleTemplateId: v.nullable(v.string()),
  courtId: v.string(),
  coachId: v.string(),
  categoryGroupId: v.string(),
  /** Nullable en Prisma. Una sesión sin hora no entra en la grilla (spec §7.2). */
  startAt: v.nullable(v.string()),
  /** Nullable en Prisma. El mapper lo normaliza a 0. */
  capacity: v.nullable(v.number()),
  /** Calculado por el backend: capacity − (confirmadas + held vigentes). */
  availableSpots: v.number(),
  /**
   * Cuántos esperan. Sale del segundo `groupBy` de `class-sessions.service.list()`, así que
   * viene en la MISMA respuesta: no hace falta una llamada por sesión llena.
   */
  waitingCount: v.number(),
  /**
   * El servicio resuelve el nombre desde su caché de catálogos y lo embebe; no es el
   * `classSessionStatusId` crudo de la fila. Valores: 'programada' | 'cancelada' | 'completada'.
   */
  classSessionStatus: v.object({ id: v.string(), name: v.string() }),
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
 * `deletedAt` SÍ se declara: es de los dos findMany que el backend NO filtra por borrados
 * (el otro es `students/:id/plans`), así que el recorte se hace en el cliente.
 */
export const SessionReservationDtoSchema = v.object({
  id: v.string(),
  studentId: v.string(),
  /** Nullable en Prisma (`schema.prisma:599`): una reserva cobrada puede no tener plan. */
  studentPlanId: v.nullable(v.string()),
  holdExpiresAt: v.nullable(v.string()),
  deletedAt: v.nullable(v.string()),
  reservationStatus: v.object({ name: v.string() }),
  /**
   * `listReservations` hace `include: { student: true }`, así que esto SIEMPRE viene. Se declara
   * sólo lo que se usa: el detalle de grupos resuelve nombre y categoría desde acá en vez de
   * pedir el padrón entero para cuatro filas.
   *
   * `firstName`/`lastName` son String? en Prisma —hay filas creadas por WhatsApp con sólo el
   * teléfono—, así que van nullables y el mapper los normaliza. Mismo criterio que students.dto.
   */
  student: v.object({
    firstName: v.nullable(v.string()),
    lastName: v.nullable(v.string()),
    categoryId: v.nullable(v.string()),
  }),
  /**
   * null cuando el panel no tomó asistencia todavía. El backend lo aplana desde la tabla
   * `attendance` con la misma cache de catálogos que usa para `classSessionStatus`
   * (`class-sessions.service.ts:124`), así que llega el nombre y no el id.
   *
   * Trae SÓLO 'asistio' / 'ausente'. La misma fila la escribe el recordatorio de WhatsApp con
   * el RSVP del alumno, y eso el backend lo manda aparte en `rsvp`: no se declara acá porque
   * ninguna pantalla lo muestra todavía, y v.object lo descarta sin romper.
   */
  attendanceStatus: v.nullable(v.object({ id: v.string(), name: v.string() })),
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
 * por `name`, así que no hace falta pedir el catálogo (existe: `GET /catalogs/attendance-statuses`,
 * ver docs/conexiones-disponibles.md §3 — sirve para MOSTRAR los otros tres estados, no para esto).
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
