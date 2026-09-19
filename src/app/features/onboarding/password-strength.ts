export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface StrengthInfo {
  label: string;
  tip: string;
  cls: string;
}

// Portado verbatim de docs/maquetas/onboarding.html (fn strength()): 0..4 según longitud y variedad.
export function passwordStrength(value: string): StrengthLevel {
  let s = 0;
  if (value.length >= 8) s++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s++;
  if (/\d/.test(value)) s++;
  if (/[^A-Za-z0-9]/.test(value)) s++;
  return Math.min(s, 4) as StrengthLevel;
}

// Tabla STR del mockup (5 entradas indexadas por el nivel 0..4).
const STRENGTH_TABLE: readonly StrengthInfo[] = [
  { label: 'Muy débil', tip: 'Sumá más caracteres', cls: 'pw-s1' },
  { label: 'Débil', tip: 'Agregá mayúsculas o números', cls: 'pw-s1' },
  { label: 'Media', tip: 'Sumá números y símbolos', cls: 'pw-s2' },
  { label: 'Fuerte', tip: '¡Buena!', cls: 'pw-s3' },
  { label: 'Excelente', tip: 'Contraseña sólida', cls: 'pw-s4' },
];

export function strengthInfo(value: string): StrengthInfo {
  return STRENGTH_TABLE[passwordStrength(value)];
}
