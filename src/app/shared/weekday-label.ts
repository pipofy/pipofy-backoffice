/**
 * Los nombres de los días. Vive en `shared/` y no en `domain/` porque es presentación, no una
 * regla del negocio — mismo criterio que `planes/plan-price.ts` y `hand-label.ts`. Está acá y
 * no en la feature de horarios desde que apareció el segundo consumidor: `features/grupos` no
 * puede importar de otra feature (boundaries), y `shared/` sí lo ve todo el mundo.
 *
 * El índice ES el `weekday` del backend: 0 = Domingo (§3.4). No reordenar este array — el
 * orden de la SEMANA se resuelve aparte, en HorariosFacade.sorted().
 */
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

export function weekdayLabel(weekday: number | null): string {
  if (weekday === null) return '—';
  return WEEKDAYS[weekday] ?? '—';
}

/** Las opciones del <select>, en orden de semana argentina: lunes primero, domingo último. */
export const WEEKDAY_OPTIONS: readonly { value: string; label: string }[] = [1, 2, 3, 4, 5, 6, 0].map(
  (n) => ({ value: String(n), label: WEEKDAYS[n] }),
);
