import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { OnboardingFacade } from './onboarding.facade';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { Registration, RegistrationInput } from '@domain/entities/registration';

function validInput(): RegistrationInput {
  return {
    role: 'profesor',
    nombre: 'Ana',
    apellido: 'Diaz',
    email: 'ana@club.com',
    password: 'Sup3rSecret!',
    phone: '1155551234',
    nombreClub: '',
    acceptedTerms: true,
  };
}

function setup(auth: { signup: (reg: Registration) => Promise<void> }) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      OnboardingFacade,
      { provide: AuthRepository, useValue: auth },
    ],
  });
  return TestBed.inject(OnboardingFacade);
}

describe('OnboardingFacade', () => {
  it('no deja error() tras un alta exitosa', async () => {
    const f = setup({ signup: async (_r: Registration) => undefined });
    await f.signup(validInput());
    expect(f.error()).toBeNull();
  });

  it('captura un DomainError si el repo falla', async () => {
    const f = setup({ signup: async () => { throw new Error('boom'); } });
    await f.signup(validInput());
    expect(f.error()?.kind).toBe('unknown');
  });

  it('captura un DomainError de dominio si la invariante falla (sin rol)', async () => {
    const f = setup({ signup: async () => undefined });
    await f.signup({ ...validInput(), role: null });
    expect(f.error()?.kind).toBe('domain'); // InvalidRegistrationError -> toDomainError
  });
});
