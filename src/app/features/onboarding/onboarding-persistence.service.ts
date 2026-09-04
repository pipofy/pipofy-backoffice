import { Injectable } from '@angular/core';
import { Role } from '@domain/entities/registration';

/** Forma cruda del FormGroup del wizard (incluye password/confirm — NO se persisten). */
export interface OnboardingFormValue {
  role: Role | null;
  account: { nombre: string; apellido: string; email: string; phone: string; password: string; confirm: string; nombreClub: string };
  acceptedTerms: boolean;
}

/** Lo que se guarda en sessionStorage: todo menos password/confirm. */
export interface OnboardingSnapshot {
  role: Role | null;
  account: { nombre: string; apellido: string; email: string; phone: string; nombreClub: string };
  acceptedTerms: boolean;
  step: string;
}

// v2: el wizard perdió los pasos professional y club. Un snapshot v1 hidrataría campos
// que ya no existen, así que se descarta cambiando la clave — sin código de migración.
const SS_KEY = 'PipoFy:onboarding:v2';

@Injectable()
export class OnboardingPersistenceService {
  save(value: OnboardingFormValue, step: string): void {
    // Se descartan password y confirm a propósito: una credencial en texto plano en
    // storage es un riesgo real (cualquier script del origen la lee).
    const snapshot: OnboardingSnapshot = {
      role: value.role,
      account: {
        nombre: value.account.nombre,
        apellido: value.account.apellido,
        email: value.account.email,
        phone: value.account.phone,
        nombreClub: value.account.nombreClub,
      },
      acceptedTerms: value.acceptedTerms,
      step,
    };
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage lleno o bloqueado: seguimos sin persistir */
    }
  }

  restore(): OnboardingSnapshot | null {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? (JSON.parse(raw) as OnboardingSnapshot) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {
      /* noop */
    }
  }
}
