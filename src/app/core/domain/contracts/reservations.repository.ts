import { ReservationDraft } from '../entities/reservation';
import { ClassPaymentDraft } from '../entities/payment';

/**
 * El ciclo de vida de una reserva: se toma el cupo (hold), y después se confirma o se cancela.
 *
 * `reserve` pega a `/class-sessions/:id/reservations` y aun así vive acá y no en
 * ClassSessionsRepository: el contrato se corta por CONCEPTO, y los tres pasos son el mismo
 * recorrido que hace la pantalla.
 *
 * `confirm` y `confirmPayment` son las DOS salidas de un hold, y no una el fallback de la
 * otra: `confirm` gasta un crédito del plan, `confirmPayment` cobra plata y NO toca los
 * créditos. Las dos dejan la reserva en 'confirmed'. Cuál corresponde lo decide el mostrador,
 * no el estado de la reserva.
 *
 * OJO con `confirm`: el backend exige que la reserva tenga un plan con créditos; si no,
 * responde 409 'Requiere pago manual, usar /reservations/:id/confirm-payment'. Ese es el
 * único caso en que una es el fallback de la otra.
 */
export abstract class ReservationsRepository {
  /**
   * Devuelve `void` como el resto de las escrituras: el hold recién creado se lee después con
   * `ClassSessionsRepository.reservations(sessionId)`, que es la fuente de verdad del roster.
   * Antes devolvía la reserva porque no había ningún GET que la mostrara.
   */
  abstract reserve(draft: ReservationDraft): Promise<void>;
  abstract confirm(id: string): Promise<void>;

  /**
   * Cobrar una clase suelta: `POST /reservations/:id/confirm-payment`. Sirve sobre CUALQUIER
   * hold vigente —tenga plan o no—, crea el `payment` confirmado y pasa la reserva a
   * 'confirmed' sin descontar créditos.
   */
  abstract confirmPayment(id: string, draft: ClassPaymentDraft): Promise<void>;

  /**
   * Cancelar. La implementación HTTP le pide al backend que le ofrezca el cupo liberado al
   * primero de la lista de espera; ver el comentario de `HttpReservationsRepository.cancel`
   * por qué esa decisión vive ahí y no acá.
   *
   * Quien llame a esto tiene que releer la lista de espera: la anotación del primero en la fila
   * pasa a 'notificado'. NO aparece un hold nuevo — el alumno tiene 15 minutos para aceptar por
   * WhatsApp y recién entonces toma el lugar.
   */
  abstract cancel(id: string): Promise<void>;
}
