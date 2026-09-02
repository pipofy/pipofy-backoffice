import { InvalidAttendanceError } from '../errors';

/**
 * La asistencia de UNA clase, tal como la escribe `POST /class-sessions/:id/attendance`.
 *
 * El prefijo `Session` no es decorativo: `AttendanceMark` YA EXISTE en `entities/group.ts` con
 * otra forma (`{ memberId, present }`) y pertenece a la maqueta de Grupos, que corre sobre un
 * repositorio en memoria y descuenta créditos AL TOMAR ASISTENCIA. Este backend los descuenta
 * al reservar y `AttendanceService` no toca créditos en absoluto. Dos entidades homónimas y
 * distintas en la misma capa es una trampa; mismo criterio que puso `session-reservation.ts`
 * al lado del concepto homónimo de grupos.
 *
 * ponytail: el union está cerrado en los dos status que este panel ESCRIBE. La tabla
 * `attendance` ya tiene filas con 'confirmo_si' / 'confirmo_no' / 'sin_respuesta' puestas por
 * WhatsApp sobre la misma fila. Techo: si algún día se LEE la asistencia, este union se queda
 * corto. Salida: un `sessionAttendanceStatusLabel()` acá mismo, estilo el
 * `reservationStatusLabel` de session-reservation.ts.
 */
export type SessionAttendanceStatus = 'asistio' | 'ausente';

export interface SessionAttendanceMark {
  readonly reservationId: string;
  readonly status: SessionAttendanceStatus;
}

/**
 * El resultado POR ÍTEM. El endpoint responde 201 con un array aunque la mitad falle: el éxito
 * parcial es un resultado de primera clase, no un borde.
 *
 * `status` viene sólo cuando `ok`; `error` sólo cuando `!ok`. Nunca los dos, nunca ninguno.
 */
export interface SessionAttendanceResult {
  readonly reservationId: string;
  readonly ok: boolean;
  readonly status: SessionAttendanceStatus | null;
  /**
   * El motivo CRUDO del backend. `markBulk` captura CUALQUIER excepción del loop en
   * `err.message`, no sólo las escritas para humanos: además de los tres mensajes de dominio
   * en castellano, por acá pueden salir "Cannot convert X to a BigInt" (mensaje de V8) y
   * "attendance_status 'asistio' no está sembrado — correr prisma:seed" (jerga de infra).
   */
  readonly error: string | null;
}

/** Tope de `@ArrayMaxSize(100)` en `MarkAttendanceBulkDto`. */
const MAX_MARCAS = 100;

/**
 * Las DOS invariantes que el backend valida a nivel DTO, y las únicas: `items` no lleva
 * `@ValidateNested()`, así que el ValidationPipe global —que corre con `whitelist: true` y
 * `forbidNonWhitelisted: true`— no mira dentro del array. Todo lo demás (que la reserva exista,
 * que pertenezca a la clase, que esté `confirmed`, que el status sea válido) se resuelve
 * per-ítem dentro del service y vuelve como `{ ok: false }`, no como un 400.
 */
export function createSessionAttendanceDraft(
  marks: readonly SessionAttendanceMark[],
): readonly SessionAttendanceMark[] {
  if (marks.length === 0) {
    throw new InvalidAttendanceError('Marcá al menos un alumno antes de guardar.');
  }
  if (marks.length > MAX_MARCAS) {
    throw new InvalidAttendanceError(
      `No se pueden guardar más de ${MAX_MARCAS} asistencias de una vez.`,
    );
  }
  return marks;
}
