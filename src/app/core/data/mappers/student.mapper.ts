import { Student, StudentDraft } from '@domain/entities/student';
import { StudentPlan } from '@domain/entities/student-plan';
import { StudentDto, StudentRequest } from '../dto/students.dto';
import { StudentPlanDto } from '../dto/student-plans.dto';
import { toYmd } from './to-ymd';

export function toStudent(dto: StudentDto): Student {
  return {
    id: dto.id,
    phone: dto.phone,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    birthDate: toYmd(dto.birthDate),
    categoryId: dto.categoryId,
    studentStatusId: dto.studentStatusId,
    dominantHand: dto.dominantHand,
    ranking: dto.ranking,
    notes: dto.notes,
  };
}

/**
 * `categoryId` se manda EN null al EDITAR: es la única forma de vaciarlo (omitirlo le da a
 * Prisma `undefined`, que significa "no toques este campo", y la categoría vieja sobrevive
 * en silencio). En el ALTA se OMITE, porque `students.service.create` hace
 * `BigInt(dto.categoryId)` apenas la clave está presente y un null sale 500 — sólo el
 * `update` pasa por `fkOpcional`. Para un alta "en null" y "ausente" significan lo mismo,
 * así que omitir no pierde nada.
 *
 * `birthDate` y `studentStatusId` se OMITEN siempre, cada uno por su motivo: el service
 * convierte el birthDate null en undefined y Prisma no toca el campo, y studentStatusId es
 * NOT NULL en la base.
 *
 * Ojo con "unificar" esto con toPlanRequest: cada mapper tiene un test que fija su regla
 * justamente para que el refactor "limpio" rompa en rojo y no en producción.
 */
export function toStudentRequest(draft: StudentDraft, modo: 'alta' | 'edicion'): StudentRequest {
  return {
    phone: draft.phone,
    firstName: draft.firstName,
    lastName: draft.lastName,
    dominantHand: draft.dominantHand,
    ranking: draft.ranking,
    notes: draft.notes,
    ...(modo === 'edicion' || draft.categoryId !== null ? { categoryId: draft.categoryId } : {}),
    ...(draft.birthDate !== null ? { birthDate: draft.birthDate } : {}),
    ...(draft.studentStatusId !== null ? { studentStatusId: draft.studentStatusId } : {}),
  };
}

/**
 * Las columnas de fecha son DateTime en Prisma y llegan como ISO completo; la pantalla sólo
 * muestra el día. Se recorta acá y no en el template para que la comparación de vencimiento
 * del dominio (studentPlanIsExpired) reciba yyyy-MM-dd de los dos lados.
 */
export function toStudentPlan(dto: StudentPlanDto): StudentPlan {
  return {
    id: dto.id,
    planId: dto.planId,
    purchasedAt: toYmd(dto.purchasedAt),
    creditsTotal: dto.creditsTotal,
    creditsRemaining: dto.creditsRemaining,
    expiresAt: toYmd(dto.expiresAt),
  };
}
