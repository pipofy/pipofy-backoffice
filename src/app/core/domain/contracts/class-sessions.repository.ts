import { ClassSession } from '../entities/class-session';
import { WaitingListEntry } from '../entities/waiting-list';
import { SessionReservation } from '../entities/session-reservation';
import { CancelClassDraft } from '../entities/class-cancellation';
import { SessionAttendanceMark, SessionAttendanceResult } from '../entities/session-attendance';

/**
 * Las clases de la agenda y su lista de espera. Clase abstracta por el mismo motivo que el
 * resto de los contratos: hace de token DI sin arrastrar @angular/core al dominio.
 *
 * `list` toma UNA fecha local ('yyyy-MM-dd') y no un rango: el ajuste de la ventana UTC del
 * backend es un detalle del borde HTTP y vive en la implementación, no en cada consumidor. Ya
 * estuvo repartido entre el repositorio del dashboard y su mapper.
 *
 * La lista de espera cuelga de acá, y no de un contrato propio, por el mismo criterio que puso
 * `/students/:id/plans` dentro de StudentsRepository: el endpoint es
 * `/class-sessions/:id/waiting-list` y un contrato aparte sólo agregaría un binding más.
 * `leaveWaitingList` es la excepción — pega a `/waiting-list/:id` — y se queda igual acá para
 * no partir en dos una operación y su inversa.
 */
export abstract class ClassSessionsRepository {
  abstract list(dateKey: string): Promise<ClassSession[]>;
  abstract waitingList(sessionId: string): Promise<WaitingListEntry[]>;
  abstract joinWaitingList(sessionId: string, studentId: string): Promise<void>;
  /** `entryId` es el id de la ANOTACIÓN (`WaitingListEntry.id`), no el del alumno. */
  abstract leaveWaitingList(entryId: string): Promise<void>;
  /**
   * Las reservas de UNA clase. Es la fuente de verdad del roster y también de los holds sin
   * confirmar: antes vivían en un Map en memoria de SesionFacade y se perdían con un F5.
   *
   * Devuelve TODOS los estados, vencidos incluidos. Nada expira los holds en la base — cada
   * query del backend filtra con `holdExpiresAt > new Date()` en tiempo de consulta —, así que
   * el recorte por vencimiento lo hace la pantalla, que ya tiene `minutosRestantes()`.
   */
  abstract reservations(sessionId: string): Promise<SessionReservation[]>;

  /**
   * Marca la asistencia de VARIAS reservas de una clase, de una sola vez.
   *
   * Vive acá y no en `ReservationsRepository` aunque la asistencia se escriba POR RESERVA y el
   * backend también exponga `POST /reservations/:id/attendance`. `reservations.repository.ts`
   * documenta el criterio contrario —"el contrato se corta por CONCEPTO", que es por lo que
   * `reserve()` vive allá aunque pegue a /class-sessions/:id/reservations— y por concepto esto
   * es de la CLASE: `markBulk` valida que cada reserva pertenezca a ese classSessionId, y la
   * unidad de trabajo del mostrador es "tomar asistencia de esta clase", no "marcar a Rita".
   *
   * ÚNICA escritura del contrato que devuelve algo, y no es un capricho: el backend responde
   * con un resultado POR ÍTEM —el éxito parcial es lo normal, no un borde— y ninguna relectura
   * lo recupera, porque `listReservations` no incluye `attendance`. Ya hay precedente de
   * escrituras que devuelven: `groups.repository.ts` (saveAttendance → snapshot completo) y
   * `schedules.repository.ts` (generateSessions → SessionGenerationResult).
   */
  abstract markAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]>;

  /**
   * Cancelar UNA clase y cancelar el día entero: la misma operación con distinto alcance, por
   * eso comparten el draft. Ver `CancelClassDraft` por todo lo que arrastra del otro lado
   * (reservas canceladas, créditos devueltos, WhatsApp).
   *
   * `cancelDay` toma la MISMA clave de fecha local ('yyyy-MM-dd') que `list`, y por el mismo
   * motivo: el backend arma la ventana del día en -03:00 a partir de ese string.
   *
   * Devuelven void como el resto de las escrituras: quien llame re-lee `list(dateKey)`.
   */
  abstract cancel(sessionId: string, draft: CancelClassDraft): Promise<void>;
  abstract cancelDay(dateKey: string, draft: CancelClassDraft): Promise<void>;
}
