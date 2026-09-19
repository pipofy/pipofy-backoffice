import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { DomainError } from '@domain/errors';
import { Registration } from '@domain/entities/registration';
import { Session } from '@domain/entities/session';
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  PasswordResetConfirmRequestSchema,
  SessionDtoSchema,
  SignupRequestSchema,
} from '../dto/auth.dto';
import { toSession, toSignupDto } from '../mappers/auth.mapper';
import { toDomainError } from '../http/to-domain-error';
import { API_CONFIG } from '@config/api-config';

/**
 * El significado de un código HTTP depende del endpoint: un 401 en /students es "tu sesión
 * venció", pero en /auth/login es "contraseña incorrecta". Por eso el mapeo específico vive
 * acá y to-domain-error.ts no se toca.
 *
 * NO se usa `ApiClient`: su `catchError` normaliza a `DomainError` (401/403 -> 'unauthorized')
 * antes de que este repo pueda leer el status crudo — un test lo confirmó (ver spec), así que
 * se habla con `HttpClient` directo, igual que hace `ApiClient` por dentro.
 */
function mapStatus(err: unknown, byStatus: Record<number, DomainError>): DomainError {
  if (err instanceof HttpErrorResponse && byStatus[err.status] !== undefined) {
    return byStatus[err.status];
  }
  return toDomainError(err);
}

@Injectable()
export class HttpAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_CONFIG).apiBaseUrl;

  private post<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body));
  }

  async signup(reg: Registration): Promise<void> {
    try {
      const body = v.parse(SignupRequestSchema, toSignupDto(reg));
      // La respuesta trae tokens; se descartan a propósito (ver AuthRepository.signup).
      await this.post<unknown>('/auth/signup', body);
    } catch (err) {
      throw mapStatus(err, { 409: { kind: 'domain', message: 'Ese email ya está registrado.' } });
    }
  }

  async login(email: string, password: string): Promise<Session> {
    try {
      const body = v.parse(LoginRequestSchema, { email, password });
      const raw = await this.post<unknown>('/auth/login', body);
      return toSession(v.parse(SessionDtoSchema, raw));
    } catch (err) {
      throw mapStatus(err, {
        401: { kind: 'invalid-credentials' },
        403: { kind: 'email-not-verified' },
      });
    }
  }

  async refresh(refreshToken: string): Promise<Session> {
    try {
      const raw = await this.post<unknown>('/auth/refresh', { refreshToken });
      return toSession(v.parse(SessionDtoSchema, raw));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      await this.post<unknown>('/auth/logout', { refreshToken });
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      // 204 sin body: HttpClient lo entrega como null y no hay nada que parsear.
      await this.post<unknown>('/auth/verify-email', { token });
    } catch (err) {
      throw mapStatus(err, { 400: { kind: 'domain', message: 'El link venció o ya fue usado.' } });
    }
  }

  async resendVerification(email: string): Promise<void> {
    try {
      // La API responde 204 siempre, exista o no el email (no revela usuarios).
      await this.post<unknown>('/auth/resend-verification', { email });
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const body = v.parse(ChangePasswordRequestSchema, { currentPassword, newPassword });
      await this.post<unknown>('/auth/change-password', body);
    } catch (err) {
      // Sale CON Bearer: authInterceptor lo excluye de PUBLIC_AUTH_PATHS a propósito.
      throw mapStatus(err, {
        401: { kind: 'domain', message: 'La contraseña actual es incorrecta.' },
      });
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      // Sin schema, igual que resendVerification: un solo campo que ya viene tipado.
      await this.post<unknown>('/auth/password-reset/request', { email });
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      const body = v.parse(PasswordResetConfirmRequestSchema, { token, newPassword });
      await this.post<unknown>('/auth/password-reset/confirm', body);
    } catch (err) {
      throw mapStatus(err, { 400: { kind: 'domain', message: 'El link venció o ya fue usado.' } });
    }
  }
}
