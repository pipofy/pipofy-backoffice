import { __Entity__, __Entity__Draft } from '@domain/entities/__entity__';
import { __Entity__Dto, __Entity__Request } from '../dto/__entities__.dto';

export function to__Entity__(dto: __Entity__Dto): __Entity__ {
  return { id: dto.id, name: dto.name ?? '' };
}

export function to__Entity__Request(draft: __Entity__Draft): __Entity__Request {
  return { name: draft.name };
}
