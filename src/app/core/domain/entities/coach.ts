/**
 * Sin delete: no hay endpoint para dar de baja un profesor. El alta SÍ existe, pero no pasa
 * por acá: crear un profesor es crear un usuario con rol 'profesor' vía `POST /users`, que
 * es lo que crea el `CoachProfile` del lado del backend. Ver `new-user.ts`.
 */
export interface Coach {
  readonly id: string;
  /** Nombre y apellido, o el email, o un placeholder: los tres campos son nullables. */
  readonly displayName: string;
  readonly description: string | null;
}

/** Lo que emite el modal. Un solo campo, pero con la misma forma que los otros modales. */
export interface CoachInput {
  readonly description: string;
}

export interface CoachDraft {
  readonly description: string | null;
}

/**
 * '' → null. La regla parece del componente pero es de la API: `description` es String? y
 * mandarla en null es la única forma de vaciarla — @IsOptional() deja pasar el null y
 * coaches.service la pasa cruda a Prisma (§3.10). Vive acá para que el día que haya un
 * segundo consumidor no queden dos criterios de qué significa "sin descripción".
 */
export function createCoachDraft(input: CoachInput): CoachDraft {
  return { description: input.description.trim() || null };
}
