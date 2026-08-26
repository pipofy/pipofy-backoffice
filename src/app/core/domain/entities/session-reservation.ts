/**
 * Una reserva de UNA clase, tal como la devuelve `GET /class-sessions/:id/reservations`.
 *
 * No confundir con lo que devolvía `POST /class-sessions/:id/reservations`: aquélla eran dos
 * campos porque el front ya tenía el resto en memoria. Ésta es la fuente de verdad del roster,
 * y por eso trae el estado: el modal necesita saber si la fila ocupa cupo o sólo espera
 * confirmación.
 *
 * `studentPlanId` es nullable en la base (`schema.prisma:599`): una reserva cobrada con
 * `confirm-payment` no gasta créditos y puede no tener plan asociado.
 */
export interface SessionReservation {
  readonly id: string;
  readonly studentId: string;
  readonly studentPlanId: string | null;
  /** El `name` crudo de `reservation_status`. Se traduce con `reservationStatusLabel()`. */
  readonly status: string;
  readonly holdExpiresAt: string | null;
}

/**
 * Los siete nombres que siembra `prisma/seed.ts:14`, en castellano.
 *
 * Vive acá y no en `catalog-labels.ts` porque este estado NO viene de `/catalogs`: el endpoint
 * lo devuelve embebido en la reserva. El archivo no tiene un solo import, así que el dominio lo
 * banca sin arrastrar nada.
 *
 * Un `Map` y no un objeto literal, por el mismo motivo que `catalogLabel()`: con un `Record`,
 * un `name` que colisione con `Object.prototype` devuelve el miembro heredado en vez de
 * `undefined`, y el `??` nunca se dispara.
 */
const RESERVATION_STATUS_LABELS = new Map<string, string>([
  ['held', 'Sin confirmar'],
  ['confirmed', 'Confirmada'],
  ['pending_review', 'En revisión'],
  ['expired', 'Vencida'],
  ['cancelled', 'Cancelada'],
  ['completed', 'Completada'],
  ['no_show', 'Ausente'],
]);

export function reservationStatusLabel(name: string): string {
  return (
    RESERVATION_STATUS_LABELS.get(name) ??
    name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}
