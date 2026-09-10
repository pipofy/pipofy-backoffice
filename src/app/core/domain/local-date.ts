/**
 * 'yyyy-MM-dd' en hora LOCAL. La única definición de "qué día es hoy" del proyecto.
 *
 * NO usar toISOString(): eso da la fecha en UTC, y en Argentina (UTC-3) todo lo que pase
 * después de las 21:00 cae en el día siguiente. Ese bug ya apareció dos veces: en la ventana
 * from/to del dashboard y en el filtro de la grilla.
 *
 * Vive en `domain` y no en `shared` porque `data` también la usa y no puede importar de
 * `shared` (boundaries). Mismo motivo y mismo lugar que occupancy.ts.
 */
export function localDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * ¿Este `startAt` crudo del backend cae en `dateKey`, en hora LOCAL?
 *
 * Vive junto a localDateKey porque es la otra mitad de la misma pregunta, y en `domain`
 * porque la usan `data` (el repositorio de clases, para recortar la ventana ±1 día) y el
 * mapper del dashboard. Estuvo escrita dos veces y ya había divergido una vez.
 *
 * Tolera `null` y basura porque `startAt` es nullable en Prisma y nadie lo valida del otro
 * lado. No avisa por consola a propósito: quien la llama distingue el motivo del descarte.
 */
export function isOnLocalDate(startAt: string | null, dateKey: string): boolean {
  if (startAt === null) return false;
  const at = new Date(startAt);
  return !Number.isNaN(at.getTime()) && localDateKey(at) === dateKey;
}

/**
 * 'HH:mm' en hora LOCAL de un `Date` ya válido.
 *
 * Vive junto a las otras dos por el mismo motivo (data la necesita y no puede importar de
 * shared). Estuvo escrita dos veces — dashboard.mapper.ts y reservas-page.component.ts — y
 * ya era la otra mitad exacta de la misma pregunta que isOnLocalDate.
 *
 * No valida `d`: a quien parsea el ISO crudo (nullable, a veces inválido) le toca decidir qué
 * hacer con eso ANTES de llamar acá — ver hora() en reservas-page.component.ts.
 */
export function localHhMm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 'yyyy-MM-dd' ± n días, en el calendario LOCAL. `new Date(y, m, d)` normaliza el desborde de
 * mes y de año solo.
 *
 * Vivía como `shiftDay` privado en `http-class-sessions.repository.ts`. Se subió acá cuando
 * apareció el segundo llamador (la ventana de grupos): es lógica de fecha local, que es lo que
 * este archivo concentra justamente para que no se resuelva dos veces y distinto.
 */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}
