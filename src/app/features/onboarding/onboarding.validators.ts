import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** minLength sobre el valor sin espacios (replica el .trim() del mockup). Vacío -> lo maneja required. */
export function trimmedMinLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (value.length === 0) return null;
    return value.length < min ? { trimmedMinLength: { min, actual: value.length } } : null;
  };
}

/**
 * Teléfono tolerante: + opcional, dígitos, espacios, guiones y paréntesis, entre 8 y 20
 * caracteres. No se normaliza a E.164 — la API lo guarda como string libre.
 * ponytail: sin validación por país; si hace falta, entra libphonenumber-js.
 */
export const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

/** Validador de grupo (account): password === confirm. Confirm vacío -> lo maneja required. */
export const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  if (!confirm) return null;
  return password === confirm ? null : { passwordsMatch: true };
};

/** Devuelve el mensaje del primer error del control según el diccionario, o '' si es válido. */
export function firstErrorMessage(control: AbstractControl, dict: Record<string, string>): string {
  const errors = control.errors;
  if (!errors) return '';
  const key = Object.keys(errors)[0];
  return dict[key] ?? 'Revisá este campo.';
}
