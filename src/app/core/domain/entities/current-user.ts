/** El usuario logueado. Sólo lo que la UI muestra: rol y club salen del JWT (SessionStore). */
export interface CurrentUser {
  readonly id: string;
  readonly email: string | null;
  /** "Ana Pérez", o el email si no hay nombre, o '' si no hay ninguno. */
  readonly displayName: string;
}
