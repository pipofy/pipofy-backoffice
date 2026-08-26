import { InvalidStudentError } from '../errors';
import { optionalInt } from '../optional-int';

/**
 * Valores de mano hábil. El backend guarda un String? libre y no siembra nada
 * (prisma/seed.ts no tiene entrada para dominant_hand, §3.9): la convención la define el
 * front y se persiste tal cual. Vive en el dominio y no en el componente porque es un
 * valor que se guarda en la base, no copy de una pantalla.
 */
export const DOMINANT_HANDS = ['diestro', 'zurdo', 'ambidiestro'] as const;
export type DominantHand = (typeof DOMINANT_HANDS)[number];

export interface Student {
  readonly id: string;
  readonly phone: string;
  /** Pueden ser '' — el backend sólo exige el teléfono. */
  readonly firstName: string;
  readonly lastName: string;
  /** yyyy-MM-dd, ya recortado del ISO que devuelve el backend. */
  readonly birthDate: string | null;
  readonly categoryId: string | null;
  /** Nunca null: la columna es NOT NULL y el alta lo fuerza a 'pending_classification'. */
  readonly studentStatusId: string;
  readonly dominantHand: string | null;
  readonly ranking: number | null;
  readonly notes: string | null;
}

export interface StudentDraft {
  readonly phone: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly birthDate: string | null;
  readonly categoryId: string | null;
  /** null = no mandarlo. Es lo que pasa en el alta, donde el backend no acepta la clave. */
  readonly studentStatusId: string | null;
  readonly dominantHand: string | null;
  readonly ranking: number | null;
  readonly notes: string | null;
}

export interface StudentInput {
  readonly phone: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;
  readonly categoryId: string;
  readonly studentStatusId: string;
  readonly dominantHand: string;
  readonly ranking: string;
  readonly notes: string;
}

export function createStudentDraft(input: StudentInput): StudentDraft {
  const phone = input.phone.trim();
  if (phone.length === 0) {
    throw new InvalidStudentError('El teléfono es obligatorio.');
  }
  return {
    phone,
    firstName: input.firstName.trim() || null,
    lastName: input.lastName.trim() || null,
    birthDate: input.birthDate || null,
    categoryId: input.categoryId || null,
    studentStatusId: input.studentStatusId || null,
    dominantHand: input.dominantHand || null,
    ranking: optionalInt(input.ranking, 'El ranking tiene que ser un número entero positivo.'),
    notes: input.notes.trim() || null,
  };
}

/** "Pérez, Ana" — o el teléfono cuando el alumno todavía no tiene nombre cargado. */
export function studentDisplayName(student: Student): string {
  const parts = [student.lastName, student.firstName].filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(', ') : student.phone;
}
