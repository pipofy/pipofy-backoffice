export type DomainError =
  | { kind: 'not-found' }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'invalid-credentials' }
  | { kind: 'email-not-verified' }
  | { kind: 'network' }
  | { kind: 'validation'; issues: string[] }
  | { kind: 'domain'; message: string }
  | { kind: 'unknown'; cause?: unknown };

const DOMAIN_ERROR_KINDS = new Set([
  'not-found', 'unauthorized', 'forbidden', 'invalid-credentials',
  'email-not-verified', 'network', 'validation', 'domain', 'unknown',
]);

// Type guard so mapping is idempotent: an already-normalized DomainError passes through unchanged.
export function isDomainError(value: unknown): value is DomainError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    DOMAIN_ERROR_KINDS.has((value as { kind: string }).kind)
  );
}

// Base for domain-invariant violations, so they surface as a real `domain` kind (not `unknown`).
export abstract class DomainRuleError extends Error {}

export class ClubInactiveError extends DomainRuleError {
  constructor(clubId: string) {
    super(`Club ${clubId} is inactive`);
    this.name = 'ClubInactiveError';
  }
}

export class InvalidRegistrationError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegistrationError';
  }
}

export class GroupNotFoundError extends DomainRuleError {
  constructor(groupId: string) {
    super(`No existe el grupo ${groupId}.`);
    this.name = 'GroupNotFoundError';
  }
}

export class GroupSessionNotFoundError extends DomainRuleError {
  constructor(groupId: string, sessionId: string) {
    super(`La sesión ${sessionId} no pertenece al grupo ${groupId}.`);
    this.name = 'GroupSessionNotFoundError';
  }
}

export class SessionCancelledError extends DomainRuleError {
  constructor() {
    super('No se puede tomar asistencia de una sesión cancelada.');
    this.name = 'SessionCancelledError';
  }
}

/**
 * DomainError → copy en español para el usuario final.
 *
 * Vive acá, JUNTO a la unión que agota, por tres razones:
 *  1. shared/ NO puede importar de domain/ (boundaries de eslint), así que
 *     shared/ui/toast/ —donde el spec §16.3 lo ubicaba— sería error de lint.
 *  2. features/* → domain SÍ está permitido: los slices 2-5 lo reusan sin duplicar.
 *  3. El switch es exhaustivo sobre DomainError['kind'] y no tiene `default`:
 *     agregar un kind a la unión de arriba ROMPE EL BUILD en este archivo
 *     (TS2366, por `noImplicitReturns`). Es imposible olvidarse de su copy.
 *
 * No es específico de toasts: un banner de error inline querría lo mismo.
 */
export function domainErrorMessage(err: DomainError): string {
  switch (err.kind) {
    case 'not-found':    return 'No encontramos lo que buscabas.';
    case 'unauthorized': return 'Tu sesión expiró. Volvé a iniciar sesión.';
    case 'forbidden':   return 'No tenés permisos para hacer esto. Pedí acceso al administrador del club.';
    case 'invalid-credentials': return 'Email o contraseña incorrectos.';
    case 'email-not-verified':  return 'Falta verificar tu email para poder entrar.';
    case 'network':      return 'No pudimos conectar con el servidor. Revisá tu conexión.';
    case 'validation':   return err.issues.length ? err.issues.join(' ') : 'Los datos enviados no son válidos.';
    case 'domain':       return err.message;
    case 'unknown':      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

export class InvalidCancellationError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCancellationError';
  }
}

export class InvalidCourtError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCourtError';
  }
}

export class InvalidCategoryError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCategoryError';
  }
}

export class InvalidCategoryGroupError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCategoryGroupError';
  }
}

export class InvalidPlanError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlanError';
  }
}

export class InvalidStudentError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStudentError';
  }
}

/**
 * La tira `optionalInt`. Vive acá porque TODAS las DomainRuleError viven acá: si se
 * dispersan, `toDomainError` deja de tener un solo lugar donde mirar.
 */
export class InvalidNumberError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNumberError';
  }
}

export class InvalidClubError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidClubError';
  }
}

/**
 * La tira `createNewUserDraft`. Vive acá porque TODAS las DomainRuleError viven acá: si se
 * dispersan, `toDomainError` deja de tener un solo lugar donde mirar.
 */
export class InvalidUserError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserError';
  }
}

/**
 * Cubre las invariantes del horario Y las del rango de generación. Una sola clase para las
 * dos porque el `kind` resultante es el mismo ('domain') y lo que la persona lee es el
 * mensaje: una segunda clase no cambiaría nada más que la cantidad de clases.
 */
export class InvalidScheduleError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScheduleError';
  }
}

export class InvalidReservationError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReservationError';
  }
}

/**
 * Cubre las invariantes de la VENTA de un plan y las del COBRO de una clase suelta. Una sola
 * clase para las dos, igual que InvalidScheduleError: los dos flujos validan lo mismo —un
 * monto y un medio de pago— y lo que la persona lee es el mensaje, no el nombre de la clase.
 */
export class InvalidPaymentError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaymentError';
  }
}
