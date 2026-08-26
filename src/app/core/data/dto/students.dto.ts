import * as v from 'valibot';

/**
 * `studentStatusId` NO es nullable: es `BigInt` a secas en el schema (schema.prisma:240) y
 * el alta lo fuerza a 'pending_classification' del lado del backend, así que toda fila lo
 * tiene. Llega como string porque el serializador global convierte los BigInt.
 *
 * v.object descarta el resto (clubId, waOptIn*, createdAt, updatedAt).
 */
export const StudentDtoSchema = v.object({
  id: v.string(),
  phone: v.string(),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  birthDate: v.nullable(v.string()),
  categoryId: v.nullable(v.string()),
  studentStatusId: v.string(),
  dominantHand: v.nullable(v.string()),
  ranking: v.nullable(v.number()),
  notes: v.nullable(v.string()),
  deletedAt: v.nullable(v.string()),
});
export type StudentDto = v.InferOutput<typeof StudentDtoSchema>;

export const StudentListDtoSchema = v.array(StudentDtoSchema);

/**
 * Write-path. TRES claves opcionales, por tres motivos distintos:
 *
 * `categoryId` se omite cuando es null porque BigInt(null) tira TypeError → 500 (§3.2).
 * `birthDate` se omite cuando es null porque mandarlo no lo vacía: el service lo convierte
 *   en undefined y Prisma no toca el campo (§3.3). Omitirlo hace lo mismo sin fingir.
 *
 * `phone` se manda siempre, pero el backend lo IGNORA en el PATCH (§3.1). Se manda igual
 *   para no tener dos schemas; el valor es el original porque el campo es readonly.
 *
 * `studentStatusId` es la TERCERA clave opcional, y por un motivo propio: el alta no lo
 *   acepta (CreateStudentDto no lo declara) pero la edición sí (UpdateStudentDto:38). Se
 *   omite en el alta —donde el backend lo fuerza a 'pending_classification'— y se manda en
 *   la edición. Nunca va en null: la columna es NOT NULL.
 */
export const StudentRequestSchema = v.object({
  phone: v.string(),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  birthDate: v.optional(v.string()),
  categoryId: v.optional(v.string()),
  studentStatusId: v.optional(v.string()),
  dominantHand: v.nullable(v.string()),
  ranking: v.nullable(v.number()),
  notes: v.nullable(v.string()),
});
export type StudentRequest = v.InferOutput<typeof StudentRequestSchema>;
