import { InvalidRegistrationError } from '../errors';

export type Role = 'profesor' | 'club';

export interface Registration {
  role: Role;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  /** Obligatorio en la API (SignupDto.phone es @IsString() sin @IsOptional). */
  phone: string;
  /** Solo para role === 'club'. Va como `nombreClub` al signup de la API. */
  nombreClub?: string;
  acceptedTerms: true;
}

/** Entrada cruda del formulario (el rol todavía puede ser null). */
export interface RegistrationInput {
  role: Role | null;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  phone: string;
  nombreClub: string;
  acceptedTerms: boolean;
}

/**
 * Backstop de dominio: arma un Registration válido o tira InvalidRegistrationError.
 * El formulario ya impide llegar en estado inválido, pero la entidad no confía en la UI.
 *
 * El .trim() vive acá y no en el componente: así "el nombre del club no puede ser espacios
 * en blanco" es una invariante del dominio y no depende de que la UI se acuerde de limpiar.
 * La contraseña es la excepción — los espacios pueden ser parte de la credencial.
 */
export function createRegistration(input: RegistrationInput): Registration {
  if (input.role !== 'profesor' && input.role !== 'club') {
    throw new InvalidRegistrationError('Elegí un rol para continuar.');
  }
  if (!input.acceptedTerms) {
    throw new InvalidRegistrationError('Tenés que aceptar los términos para crear la cuenta.');
  }
  const phone = input.phone.trim();
  if (!phone) {
    throw new InvalidRegistrationError('Ingresá un teléfono de contacto.');
  }
  const base = {
    role: input.role,
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    email: input.email.trim(),
    password: input.password,
    phone,
    acceptedTerms: true as const,
  };
  if (input.role === 'club') {
    const nombreClub = input.nombreClub.trim();
    if (!nombreClub) {
      throw new InvalidRegistrationError('Ingresá el nombre del club.');
    }
    return { ...base, nombreClub };
  }
  return base;
}
