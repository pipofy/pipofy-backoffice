import { InvalidReservationError } from '../errors';

/** Lo que sale de los selects del modal: vacío es '', no null. */
export interface ReservationInput {
  readonly sessionId: string;
  readonly studentId: string;
  readonly studentPlanId: string;
}

export interface ReservationDraft {
  readonly sessionId: string;
  readonly studentId: string;
  readonly studentPlanId: string;
}

/**
 * El plan es OBLIGATORIO, y no es una preferencia de UI.
 *
 * `ReservationsService.confirm()` exige que la reserva tenga un plan con créditos; sin eso
 * responde 409 'Requiere pago manual, usar /reservations/:id/confirm-payment', y ese endpoint
 * está bloqueado porque pide un `paymentMethodId` que ningún catálogo de la API expone.
 * Reservar sin plan es fabricar un cupo tomado que nadie puede confirmar y que se evapora
 * solo en 30 minutos.
 *
 * El modal ya deshabilita el botón; la entidad no confía en la UI.
 *
 * ponytail: la reserva exige plan aunque `confirm-payment` ya funcione y pueda cobrar un hold
 * sin plan. Techo: un alumno sin plan vigente no se puede anotar desde acá aunque vaya a pagar
 * en el mostrador. Salida: aceptar `studentPlanId` vacío y que el mostrador resuelva por
 * "Cobrar" — es un cambio de flujo, no de código, y hay que decidirlo antes.
 */
export function createReservationDraft(input: ReservationInput): ReservationDraft {
  if (!input.studentId) {
    throw new InvalidReservationError('Elegí un alumno.');
  }
  if (!input.studentPlanId) {
    throw new InvalidReservationError(
      'Elegí un plan con créditos: sin plan la reserva no se puede confirmar.',
    );
  }
  return {
    sessionId: input.sessionId,
    studentId: input.studentId,
    studentPlanId: input.studentPlanId,
  };
}
