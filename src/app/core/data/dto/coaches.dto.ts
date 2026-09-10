import * as v from 'valibot';

/**
 * `user` es OPCIONAL porque coaches.service.getOne() no lo incluye — sólo list() lo hace
 * (§3.8). Los tres campos son String? en el modelo User de Prisma: nullables los tres.
 *
 * Campos en español (`nombre`, `apellido`) porque así se llaman en el schema: es la única
 * parte de la API que no está en inglés.
 */
export const CoachDtoSchema = v.object({
  id: v.string(),
  description: v.nullable(v.string()),
  user: v.optional(
    v.object({
      nombre: v.nullable(v.string()),
      apellido: v.nullable(v.string()),
      email: v.nullable(v.string()),
    }),
  ),
});
export type CoachDto = v.InferOutput<typeof CoachDtoSchema>;

export const CoachListDtoSchema = v.array(CoachDtoSchema);

/**
 * Write-path. Un solo campo: es lo único que UpdateCoachDto declara y lo único que el
 * service escribe (§3.10). Acepta null porque es cómo se vacía la columna.
 */
export const CoachRequestSchema = v.object({
  description: v.nullable(v.string()),
});
export type CoachRequest = v.InferOutput<typeof CoachRequestSchema>;
