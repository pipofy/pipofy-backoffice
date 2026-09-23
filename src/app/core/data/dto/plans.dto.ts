import * as v from 'valibot';

/**
 * `price` acepta string|number a propósito: Prisma serializa Decimal vía decimal.js, cuyo
 * toJSON devuelve string, pero no se pudo verificar con el servidor levantado (§3.5). El
 * mapper normaliza a string. Si llegara como número, la lista no se cae.
 */
export const PlanDtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  planTypeId: v.string(),
  coachId: v.nullable(v.string()),
  classCount: v.nullable(v.number()),
  price: v.nullable(v.union([v.string(), v.number()])),
  validityDays: v.nullable(v.number()),
  active: v.boolean(),
});
export type PlanDto = v.InferOutput<typeof PlanDtoSchema>;

export const PlanListDtoSchema = v.array(PlanDtoSchema);

/**
 * Write-path.
 *
 * `coachId` es nullish: EN null al editar, que es la única forma de vaciarlo, y AUSENTE en
 * el alta — ver toPlanRequest para por qué el alta omite aunque el backend lo aguante.
 *
 * `price` es string incluso siendo un número: el backend lo valida con @IsNumberString()
 * y un número JSON da 400 (§3.5).
 *
 * El resto SÍ acepta null: es la única forma de vaciarlos (§3.3).
 *
 * Que la clave quede ausente o en `undefined` es indistinto: HttpClient serializa con
 * JSON.stringify, que descarta las claves con valor undefined.
 */
export const PlanRequestSchema = v.object({
  name: v.nullable(v.string()),
  planTypeId: v.string(),
  coachId: v.nullish(v.string()),
  classCount: v.nullable(v.number()),
  price: v.nullable(v.string()),
  validityDays: v.nullable(v.number()),
  active: v.boolean(),
});
export type PlanRequest = v.InferOutput<typeof PlanRequestSchema>;
