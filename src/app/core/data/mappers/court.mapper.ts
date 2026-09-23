import { Court, CourtDraft } from '@domain/entities/court';
import { CourtDto, CourtRequest } from '../dto/courts.dto';

export function toCourt(dto: CourtDto): Court {
  return {
    id: dto.id,
    name: dto.name ?? '',
    code: dto.code,
    surfaceTypeId: dto.surfaceTypeId,
    indoor: dto.indoor ?? false,
    courtStatusId: dto.courtStatusId,
  };
}

/**
 * Los FK se mandan EN null al EDITAR: es la única forma de vaciarlos, igual que `code`.
 * En el ALTA se OMITEN, porque `courts.service.create` hace `BigInt(dto.surfaceTypeId)`
 * apenas la clave está presente y un null sale 500 — sólo el `update` pasa por
 * `fkOpcional`. Para un alta "en null" y "ausente" significan lo mismo (§4.5).
 *
 * Ojo con "unificar" esto con toCategoryRequest, que hace lo contrario a propósito.
 */
export function toCourtRequest(draft: CourtDraft, modo: 'alta' | 'edicion'): CourtRequest {
  const editando = modo === 'edicion';
  return {
    name: draft.name,
    code: draft.code,
    indoor: draft.indoor,
    ...(editando || draft.surfaceTypeId !== null ? { surfaceTypeId: draft.surfaceTypeId } : {}),
    ...(editando || draft.courtStatusId !== null ? { courtStatusId: draft.courtStatusId } : {}),
  };
}
