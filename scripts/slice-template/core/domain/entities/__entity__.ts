import { Invalid__Entity__Error } from '../errors';

export interface __Entity__ {
  readonly id: string;
  /** Puede ser '': la lectura es tolerante con filas incompletas. */
  readonly name: string;
}

/** Lo que el formulario produce. Sin `id`: alta y edición mandan el mismo cuerpo. */
export interface __Entity__Draft {
  readonly name: string;
}

/** Lo que sale de los controles del form. */
export interface __Entity__Input {
  readonly name: string;
}

/** La invariante corre SÓLO en escritura. */
export function create__Entity__Draft(input: __Entity__Input): __Entity__Draft {
  const name = input.name.trim();
  if (!name) throw new Invalid__Entity__Error('El nombre de __label__ es obligatorio.');
  return { name };
}
