import { Plan, PlanDraft } from '@domain/entities/plan';
import { PlanDto, PlanRequest } from '../dto/plans.dto';

export function toPlan(dto: PlanDto): Plan {
  return {
    id: dto.id,
    name: dto.name ?? '',
    planTypeId: dto.planTypeId,
    coachId: dto.coachId,
    classCount: dto.classCount,
    // String() y no un cast: el DTO acepta number por la incertidumbre del §3.5.
    price: dto.price === null ? null : String(dto.price),
    validityDays: dto.validityDays,
    active: dto.active,
  };
}

/**
 * `coachId` se manda EN null al EDITAR: es la única forma de vaciarlo, igual que el resto
 * de los opcionales (omitirlo le da a Prisma `undefined`, que significa "no toques este
 * campo", y el profesor viejo sobreviviría en silencio).
 *
 * En el ALTA se OMITE. Acá `plans.service.create` sí pasa por `fkOpcional` y aguantaría el
 * null, pero para un alta "en null" y "ausente" significan lo mismo, y omitir mantiene UNA
 * sola regla en los tres mappers en vez de tres excepciones que hay que recordar.
 *
 * Ojo con "unificar" esto con toStudentRequest: ese omite DOS claves más (birthDate y
 * studentStatusId), y por motivos distintos. Cada mapper tiene un test que fija su regla
 * justamente para que el refactor "limpio" rompa en rojo y no en producción.
 */
export function toPlanRequest(draft: PlanDraft, modo: 'alta' | 'edicion'): PlanRequest {
  return {
    name: draft.name,
    planTypeId: draft.planTypeId,
    classCount: draft.classCount,
    price: draft.price,
    validityDays: draft.validityDays,
    active: draft.active,
    ...(modo === 'edicion' || draft.coachId !== null ? { coachId: draft.coachId } : {}),
  };
}
