import { InvalidCancellationError } from '../errors';

/**
 * Cancelar una clase, o el día entero. Las dos operaciones toman lo MISMO, así que comparten
 * entidad: `DELETE /class-sessions/:id` y `DELETE /class-sessions/day?date=`.
 *
 * No es "borrar una fila". Del otro lado, en una sola transacción, el backend pasa la clase a
 * 'cancelada', cancela todas las reservas vivas —confirmadas, holds vigentes y
 * pending_review— y le DEVUELVE EL CRÉDITO a cada alumno que efectivamente lo había gastado
 * (busca el CreditLedger de débito real; no se fía del studentPlanId, que también se setea en
 * caminos que nunca debitaron). Con `notify` además le manda un WhatsApp a cada uno.
 *
 * Por eso el motivo es obligatorio cuando se avisa: ese texto es el que le llega a la gente.
 */
export interface CancelClassInput {
  readonly reason: string;
  readonly notify: boolean;
}

export interface CancelClassDraft {
  readonly notify: boolean;
  /** null = no mandar la clave. */
  readonly reason: string | null;
}

/**
 * La invariante duplica la del backend (`@ValidateIf(o => o.notify === true)` sobre `reason`)
 * a propósito: acá la persona ve el error mientras escribe, en vez de perder el modal contra
 * un 400. Es la misma razón por la que `createStudentDraft` valida el teléfono.
 */
export function createCancelClassDraft(input: CancelClassInput): CancelClassDraft {
  const reason = input.reason.trim();
  if (input.notify && reason.length === 0) {
    throw new InvalidCancellationError(
      'Escribí el motivo: es el texto que le va a llegar por WhatsApp a cada alumno.',
    );
  }
  return { notify: input.notify, reason: reason || null };
}
