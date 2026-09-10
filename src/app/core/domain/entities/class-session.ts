/**
 * Una clase de la agenda: `GET /class-sessions`.
 *
 * `startAt` queda como el ISO CRUDO del backend, sin parsear: quién lo interpreta decide en
 * qué zona hacerlo, y el proyecto ya se quemó dos veces resolviendo eso en UTC (ver
 * local-date.ts). `capacity` sí se normaliza — es nullable en Prisma y ninguna pantalla
 * quiere pensar en un cupo que no existe.
 */
export interface ClassSession {
  readonly id: string;
  readonly courtId: string;
  readonly coachId: string;
  readonly categoryGroupId: string;
  readonly startAt: string | null;
  readonly capacity: number;
  /** Calculado por el backend: capacity − (confirmadas + held vigentes). */
  readonly availableSpots: number;
  /** Cuántos esperan lugar. Viene en la misma respuesta que la sesión. */
  readonly waitingCount: number;
  /** Nombre del catálogo: 'programada' | 'cancelada' | 'completada'. */
  readonly status: string;
}

/** Lugares tomados. `capacity - availableSpots`, con piso en 0 por si el backend deriva. */
export function occupiedSpots(session: ClassSession): number {
  return Math.max(0, session.capacity - session.availableSpots);
}

/** El literal del catálogo vive acá y no en las pantallas. */
export function isCancelled(session: ClassSession): boolean {
  return session.status === 'cancelada';
}
