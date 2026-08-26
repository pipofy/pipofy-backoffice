/**
 * Los catálogos llegan con el `name` crudo del seed, en snake_case, y no se puede mostrar
 * `polvo_ladrillo` en un select.
 *
 * Vive en `data`, junto a `catalogs.dto.ts` y `CatalogsRepository` (su familia), y no en
 * `shared`: lo consumen el mapper del dashboard (capa `data`) y las pantallas de
 * Configuración (capa `features`), y `data` no puede importar de `shared` (boundaries) —
 * sólo de `domain` y de sí misma. No tiene un solo import propio, así que puede vivir en
 * cualquiera de las dos capas sin arrastrar nada; `data` es la que respeta la regla.
 *
 * El mapa es explícito porque el humanizador genérico no acierta ni el "de" de "polvo de
 * ladrillo" ni la tilde de "sintético". El fallback existe para que un valor nuevo del seed
 * se vea aceptable en vez de romper.
 */
const CATALOG_LABELS = new Map<string, string>([
  ['polvo_ladrillo', 'Polvo de ladrillo'],
  ['cemento', 'Cemento'],
  ['sintetico', 'Sintético'],
  ['disponible', 'Disponible'],
  ['mantenimiento', 'En mantenimiento'],
  ['inactiva', 'Inactiva'],
  ['mensual_grupal', 'Mensual grupal'],
  ['individual', 'Individual'],
  ['nivelacion', 'Nivelación'],
  // Medios de pago. 'mp_link' es el único que el humanizador genérico dejaría como "Mp link".
  ['transferencia', 'Transferencia'],
  ['efectivo', 'Efectivo'],
  ['mp_link', 'Link de Mercado Pago'],
  // Estados del alumno. 'pending_classification' NO se humaniza como "Pending classification":
  // es el alumno que entró por WhatsApp y todavía no tiene categoría asignada.
  ['active', 'Activo'],
  ['pending_classification', 'Sin clasificar'],
  ['inactive', 'Inactivo'],
]);

/**
 * Un `Map` y no un objeto literal: con `CATALOG_LABELS[name]` sobre un `Record`, un `name`
 * que colisione con algo de `Object.prototype` devuelve el miembro heredado en vez de
 * `undefined` — `catalogLabel('constructor')` daba la función `Object` y el `??` nunca se
 * disparaba. TypeScript tipa eso como `string` igual, así que el compilador no lo ve.
 */
export function catalogLabel(name: string): string {
  return CATALOG_LABELS.get(name) ?? name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
