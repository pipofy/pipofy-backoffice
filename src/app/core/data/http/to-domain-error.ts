import { HttpErrorResponse } from '@angular/common/http';
import * as v from 'valibot';
import { DomainError, asDomainError } from '@domain/errors';

/**
 * NestJS serializa sus excepciones como { statusCode, message, error }, donde `message`
 * es un string cuando viene de `new BadRequestException('...')` y un string[] cuando lo
 * genera el ValidationPipe. Se cubren las dos formas.
 */
function nestMessage(err: HttpErrorResponse): string {
  const raw: unknown = err.error?.message;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0 && raw.every((i) => typeof i === 'string')) {
    return raw.join(' ');
  }
  return 'No pudimos guardar los cambios. Revisá los datos e intentá de nuevo.';
}

export function toDomainError(err: unknown): DomainError {
  if (err instanceof v.ValiError) {
    return { kind: 'validation', issues: err.issues.map((i) => i.message) };
  }
  if (err instanceof HttpErrorResponse) {
    switch (err.status) {
      case 0: return { kind: 'network' };
      case 401: return { kind: 'unauthorized' };
      // 403 NO es 401: con rol `superprofesor` el 403 es permanente y decirle "tu sesión
      // expiró" lo manda a reloguearse para chocar con exactamente lo mismo (§4.7).
      case 403: return { kind: 'forbidden' };
      case 404: return { kind: 'not-found' };
      // En un CRUD el mensaje del backend ES el feedback útil.
      case 400:
      case 409: return { kind: 'domain', message: nestMessage(err) };
      default: return { kind: 'unknown', cause: err };
    }
  }
  // DomainError ya normalizado (idempotente), DomainRuleError, o cualquier otra cosa.
  return asDomainError(err);
}
