import * as v from 'valibot';

/** Lectura tolerante: el backend puede guardar filas incompletas. */
export const __Entity__DtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
});
export type __Entity__Dto = v.InferOutput<typeof __Entity__DtoSchema>;
export const __Entity__ListDtoSchema = v.array(__Entity__DtoSchema);

/** Write-path: sólo lo que el backend acepta. */
export const __Entity__RequestSchema = v.object({
  name: v.string(),
});
export type __Entity__Request = v.InferOutput<typeof __Entity__RequestSchema>;
