import { describe, it, expect, beforeEach } from 'vitest';
import { OnboardingPersistenceService, OnboardingFormValue } from './onboarding-persistence.service';

function formValue(): OnboardingFormValue {
  return {
    role: 'club',
    account: { nombre: 'Ana', apellido: 'Diaz', email: 'ana@club.com', phone: '1155551234', password: 'secreta123', confirm: 'secreta123', nombreClub: 'Club Solaris' },
    acceptedTerms: true,
  };
}

describe('OnboardingPersistenceService', () => {
  beforeEach(() => sessionStorage.clear());

  it('guarda y restaura, pero NUNCA persiste la contraseña', () => {
    const svc = new OnboardingPersistenceService();
    svc.save(formValue(), 'account');
    const raw = sessionStorage.getItem('PipoFy:onboarding:v2') ?? '';
    expect(raw).not.toContain('secreta123');

    const snap = svc.restore()!;
    expect(snap).not.toBeNull();
    expect(snap.account).toEqual({ nombre: 'Ana', apellido: 'Diaz', email: 'ana@club.com', phone: '1155551234', nombreClub: 'Club Solaris' });
    expect('password' in (snap.account as object)).toBe(false);
    expect(snap.step).toBe('account');
  });

  it('restore devuelve null si no hay nada guardado', () => {
    expect(new OnboardingPersistenceService().restore()).toBeNull();
  });

  it('clear borra el snapshot', () => {
    const svc = new OnboardingPersistenceService();
    svc.save(formValue(), 'role');
    svc.clear();
    expect(svc.restore()).toBeNull();
  });
});
