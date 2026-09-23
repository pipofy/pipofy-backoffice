/**
 * "12000.5" → "$12.001". Redondea a pesos.
 *
 * El fallback de "no es un número" existe porque el precio llega de un Decimal de Prisma
 * cuya serialización no se pudo verificar (§3.5): mostrar el crudo es más útil que "$NaN".
 */
export function formatPlanPrice(price: string | null, locale: string): string {
  if (price === null) return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return '$' + Math.round(n).toLocaleString(locale);
}
