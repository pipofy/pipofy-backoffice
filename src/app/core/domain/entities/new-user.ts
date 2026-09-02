import { InvalidUserError } from '../errors';

/**
 * Lo que emite el formulario de alta. SIN `roleId`: la UI no elige rol —siempre es
 * 'profesor'— y el id de ese rol lo resuelve la facade contra `GET /roles` (§4.3).
 */
export interface NewUserInput {
  readonly email: string;
  readonly nombre: string;
  readonly apellido: string;
}

/** Lo que viaja al backend. `nombre` y `apellido` en null los OMITE el mapper. */
export interface NewUser {
  readonly email: string;
  readonly nombre: string | null;
  readonly apellido: string | null;
  readonly roleId: string;
}

/**
 * Backstop de dominio del alta de usuario.
 *
 * El FORMATO del email no se valida acá: lo hace el formulario con `EMAIL_RE` de
 * `@shared/validators/email`, igual que `createRegistration`. `domain` no puede importar de
 * `shared` (boundaries), y duplicar el regex crearía dos criterios de qué es un email válido.
 * Lo que sí es invariante de dominio es que no esté vacío.
 *
 * El `trim()` vive acá y no en el componente, por el mismo argumento que `createRegistration`:
 * así "el nombre no puede ser espacios en blanco" no depende de que la UI se acuerde de limpiar.
 */
export function createNewUserDraft(input: NewUserInput, roleId: string): NewUser {
  const email = input.email.trim();
  if (email.length === 0) {
    throw new InvalidUserError('El email es obligatorio.');
  }
  const rol = roleId.trim();
  if (rol.length === 0) {
    throw new InvalidUserError('No se pudo determinar el rol a asignar.');
  }
  return {
    email,
    nombre: input.nombre.trim() || null,
    apellido: input.apellido.trim() || null,
    roleId: rol,
  };
}
