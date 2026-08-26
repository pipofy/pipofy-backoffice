/**
 * JWTs codifican el payload en base64url (RFC 7515): `-`/`_` en vez de `+`/`/`, sin
 * padding `=`. `atob()` sólo entiende el alfabeto base64 estándar y tira `Invalid
 * character` apenas aparece un `-` o un `_` — que ocurre para cualquier token real cuyos
 * bytes caigan ahí, no es un caso raro. Por eso se traduce el alfabeto y se repone el
 * padding antes de decodificar.
 */
function base64UrlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
}

/**
 * El payload decodificado, o null si el token está corrupto.
 *
 * NO verifica la firma — eso es responsabilidad del backend, que rechaza cualquier token
 * adulterado. Acá solo se leen datos para poblar TenantContext y pintar la pantalla; si alguien
 * falsea su propio token en el browser, la API igual le responde 401.
 */
function readPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(accessToken.split('.')[1]));
    return typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function readClubId(accessToken: string): string | null {
  const clubId = readPayload(accessToken)?.['clubId'];
  return typeof clubId === 'string' ? clubId : null;
}

/**
 * Los roles del club que trae el token (`auth.service.ts:208`): 'admin', 'encargado',
 * 'profesor' o 'superprofesor'. El pie del sidebar los muestra.
 */
export function readRoles(accessToken: string): readonly string[] {
  const roles = readPayload(accessToken)?.['roles'];
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
}
