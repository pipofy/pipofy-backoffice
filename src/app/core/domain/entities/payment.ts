import { InvalidPaymentError } from '../errors';

/**
 * Las dos escrituras de plata del panel: vender un plan a un alumno
 * (`POST /students/:id/plans`) y cobrar una clase suelta
 * (`POST /reservations/:id/confirm-payment`).
 *
 * Comparten archivo porque comparten las DOS invariantes que importan —monto y medio de
 * pago—, y separarlas dejaría `createPlanPurchaseDraft` y `createClassPaymentDraft`
 * validando el monto con dos copias de la misma regla. La compra agrega el plan; el cobro
 * no agrega nada.
 */

/** Lo que sale de los inputs del modal: vacío es '', no null. */
export interface PlanPurchaseInput {
  readonly planId: string;
  readonly paymentMethodId: string;
  readonly amount: string;
}

export interface PlanPurchaseDraft {
  readonly planId: string;
  readonly paymentMethodId: string;
  readonly amount: string;
}

export interface ClassPaymentInput {
  readonly paymentMethodId: string;
  readonly amount: string;
}

export interface ClassPaymentDraft {
  readonly paymentMethodId: string;
  readonly amount: string;
}

/**
 * El monto viaja como STRING hasta el backend y vuelve string: del otro lado es un
 * `new Prisma.Decimal(dto.amount)`, que con cualquier cosa que no parsee tira y sale como
 * 400 'amount inválido'. Se valida acá para no gastar la ida y vuelta, y se manda el texto
 * normalizado —sin espacios, con punto decimal— y no el `Number`, porque pasar por float
 * es justo lo que un Decimal existe para evitar.
 *
 * Cero es válido a propósito: un plan de cortesía se registra como una compra de $0, y el
 * backend lo acepta. Negativo no: una devolución no es una venta, va por `credit_ledger`.
 */
/**
 * Dígitos, y a lo sumo dos decimales tras una coma o un punto. NADA MÁS — y la estrechez es
 * el punto, no una molestia:
 *
 * `Number()` acepta cosas que en un campo de plata son una trampa. `Number('96.000')` es 96,
 * no noventa y seis mil: la tabla de planes muestra "$96.000" (separador de miles es-AR, ver
 * `formatPlanPrice`), así que el encargado que escribe lo que ve cobraba MIL VECES MENOS sin
 * que nada avisara. `Number('0x1a')` es 26 y `Number('1e3')` es 1000, por el mismo agujero.
 *
 * Un separador de miles ahora se RECHAZA con un mensaje que dice cómo escribirlo. Rechazar es
 * barato; cobrar $96 en vez de $96.000 se descubre al cerrar la caja.
 */
const AMOUNT = /^\d+(?:[.,]\d{1,2})?$/;

function normalizeAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new InvalidPaymentError('Ingresá el monto cobrado.');
  }
  if (trimmed.startsWith('-')) {
    throw new InvalidPaymentError('El monto no puede ser negativo.');
  }
  if (!AMOUNT.test(trimmed)) {
    throw new InvalidPaymentError(
      'El monto va sin separador de miles y con hasta dos decimales: escribí 96000 o 96000,50.',
    );
  }
  return trimmed.replace(',', '.');
}

function requireMethod(paymentMethodId: string): string {
  if (!paymentMethodId) {
    throw new InvalidPaymentError('Elegí un medio de pago.');
  }
  return paymentMethodId;
}

export function createPlanPurchaseDraft(input: PlanPurchaseInput): PlanPurchaseDraft {
  if (!input.planId) {
    throw new InvalidPaymentError('Elegí el plan que estás vendiendo.');
  }
  return {
    planId: input.planId,
    paymentMethodId: requireMethod(input.paymentMethodId),
    amount: normalizeAmount(input.amount),
  };
}

export function createClassPaymentDraft(input: ClassPaymentInput): ClassPaymentDraft {
  return {
    paymentMethodId: requireMethod(input.paymentMethodId),
    amount: normalizeAmount(input.amount),
  };
}
