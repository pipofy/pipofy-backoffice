import * as v from 'valibot';

// La API es NestJS + Prisma y responde camelCase — a diferencia de los DTOs snake_case
// del dashboard y de grupos. El schema es la única fuente de verdad del tipo.

export const SessionDtoSchema = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  // POST /auth/signup y POST /auth/refresh NO lo mandan; POST /auth/login sí.
  // El default deja que un solo schema cubra las tres respuestas.
  mustChangePassword: v.optional(v.boolean(), false),
});
export type SessionDto = v.InferOutput<typeof SessionDtoSchema>;

// Write-path: los request se validan con v.parse ANTES de salir, igual que las
// respuestas al entrar (convención establecida en el slice del dashboard).
export const SignupRequestSchema = v.object({
  email: v.string(),
  password: v.string(),
  tipo: v.picklist(['club', 'particular']),
  nombre: v.string(),
  apellido: v.string(),
  // Obligatorio del lado de la API desde que SignupDto lo marca @IsString() sin
  // @IsOptional(): omitirlo devuelve 400 "phone must be a string".
  phone: v.string(),
  nombreClub: v.optional(v.string()),
});
export type SignupRequest = v.InferOutput<typeof SignupRequestSchema>;

export const LoginRequestSchema = v.object({
  email: v.string(),
  password: v.string(),
});
export type LoginRequest = v.InferOutput<typeof LoginRequestSchema>;

export const ChangePasswordRequestSchema = v.object({
  currentPassword: v.string(),
  newPassword: v.string(),
});
export type ChangePasswordRequest = v.InferOutput<typeof ChangePasswordRequestSchema>;

export const PasswordResetConfirmRequestSchema = v.object({
  token: v.string(),
  newPassword: v.string(),
});
export type PasswordResetConfirmRequest = v.InferOutput<typeof PasswordResetConfirmRequestSchema>;
