import { Group } from '@domain/entities/group';
import { localHhMm } from '@domain/local-date';
import { weekdayLabel } from '@shared/weekday-label';

/** Guión largo (EM DASH, U+2014), igual que la maqueta. */
const DASH = '—';

export type OccupancyState = 'low' | 'ok' | 'full';

/**
 * Estado de ocupación de un grupo. Origen: index-v2.html:1698-1701.
 * 'full' GANA sobre 'low' (un grupo de capacidad 0 está lleno, no vacío).
 */
export function occupancyState(enrolled: number, capacity: number): OccupancyState {
  if (capacity <= 0) return 'full';
  if (enrolled >= capacity) return 'full';
  if (enrolled <= capacity * 0.5) return 'low';   // el borde EXACTO de 50% es 'low'
  return 'ok';
}

/**
 * El título del grupo: '7ma+8va · Lunes 18:00'.
 *
 * Se arma acá y no en el mapper porque necesita `weekdayLabel`, que vive en `shared/`, y
 * `core/data` no puede importar `shared/` (boundaries). Es presentación de todos modos.
 */
export function groupTitle(g: Group): string {
  const cuando = [weekdayLabel(g.weekday), g.startTime].filter((p) => p && p !== DASH).join(' ');
  return cuando ? `${g.category} · ${cuando}` : g.category;
}

/**
 * '2026-09-14T21:00:00.000Z' → '14/09', en zona LOCAL. Es la fecha que ve el club.
 *
 * A mano y no con DatePipe: `new DatePipe('es-AR')` TIRA si el locale no está registrado con
 * `registerLocaleData`, y este proyecto no lo registra. Un `| date` en el template funcionaría
 * —cae al LOCALE_ID por defecto— pero entonces el mismo formato quedaría resuelto de dos maneras
 * distintas según se lo pida un template o una clase.
 */
export function fechaCorta(startAt: string | null): string {
  if (startAt === null) return DASH;
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** '21:00' en zona local. Reusa `localHhMm`, que ya resuelve esto para el resto del repo. */
export function horaCorta(startAt: string | null): string {
  if (startAt === null) return DASH;
  const d = new Date(startAt);
  return Number.isNaN(d.getTime()) ? DASH : localHhMm(d);
}

/**
 * Iniciales para el avatar. Las calcula el front: el backend manda nombre y apellido y nada más.
 * Toma la primera letra de las dos primeras palabras.
 */
export function initials(name: string): string {
  const letras = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '');
  return letras.join('') || DASH;
}
