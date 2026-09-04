import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SessionStore } from './session-store';
import { readClubId, readRoles } from './jwt-claims';

function store(): SessionStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), SessionStore],
  });
  return TestBed.inject(SessionStore);
}

/**
 * JWT armado a mano: header.payload.signature, payload en base64url real (RFC 7515):
 * `+`→`-`, `/`→`_`, sin padding `=`. `btoa()` solo da base64 estándar, así que se traduce
 * a mano — si no, este fixture nunca ejercita el alfabeto que un JWT real usa.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${b64url}.s`;
}

// A nivel de archivo (no de un describe puntual): los describes de más abajo (readClubId,
// readRoles, datos derivados del token) son hermanos de 'SessionStore', no hijos — un
// beforeEach adentro de ese describe no los alcanzaría y el test 'sin sesión' del último
// arrancaría con el localStorage sucio que deja el test del F5.
beforeEach(() => localStorage.clear());

describe('SessionStore', () => {
  it('arranca vacío y no autenticado', () => {
    const s = store();
    expect(s.accessToken()).toBeNull();
    expect(s.isAuthenticated()).toBe(false);
  });

  it('set() guarda los tres campos y marca autenticado', () => {
    const s = store();
    s.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
    expect(s.accessToken()).toBe('a');
    expect(s.refreshToken()).toBe('r');
    expect(s.mustChangePassword()).toBe(true);
    expect(s.isAuthenticated()).toBe(true);
  });

  it('rehidrata desde localStorage al construirse', () => {
    store().set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
    const otro = store();               // instancia nueva, mismo localStorage
    expect(otro.accessToken()).toBe('a');
    expect(otro.mustChangePassword()).toBe(true);
  });

  it('setTokens() renueva los tokens SIN pisar mustChangePassword', () => {
    const s = store();
    s.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
    s.setTokens('a2', 'r2');
    expect(s.accessToken()).toBe('a2');
    expect(s.refreshToken()).toBe('r2');
    expect(s.mustChangePassword()).toBe(true);   // <- el punto del método
  });

  it('passwordChanged() baja la bandera y la persiste, sin tocar los tokens', () => {
    // Sin persistir, un F5 después del cambio obligatorio rehidrataba mustChangePassword en
    // true y el guard volvía a mandar a /cambiar-clave con la contraseña ya cambiada.
    const s = store();
    s.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: true });
    s.passwordChanged();
    expect(s.mustChangePassword()).toBe(false);
    expect(s.accessToken()).toBe('a');
    expect(store().mustChangePassword()).toBe(false);   // instancia nueva, mismo storage
  });

  it('clear() borra memoria y storage', () => {
    const s = store();
    s.set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: false });
    s.clear();
    expect(s.isAuthenticated()).toBe(false);
    expect(store().accessToken()).toBeNull();
  });

  it('un localStorage con basura no rompe la construcción', () => {
    localStorage.setItem('PipoFy:session:v1', 'no-es-json');
    expect(store().isAuthenticated()).toBe(false);
  });
});

describe('readClubId', () => {
  it('lee el clubId del payload', () => {
    expect(readClubId(fakeJwt({ sub: '1', clubId: '42' }))).toBe('42');
  });

  it('devuelve null si el token no tiene clubId', () => {
    expect(readClubId(fakeJwt({ sub: '1' }))).toBeNull();
  });

  it('devuelve null si el token está malformado', () => {
    expect(readClubId('no-es-un-jwt')).toBeNull();
  });

  it('lee el clubId de un token cuyo payload codifica a caracteres base64url (- o _)', () => {
    // clubId elegido para que el base64 estándar resultante contenga '/' (-> '_' en
    // base64url): sin esto el fixture no distingue atob() de un decoder base64url real.
    const token = fakeJwt({ sub: '1', clubId: '42?7' });
    expect(token).toMatch(/[-_]/);
    expect(readClubId(token)).toBe('42?7');
  });
});

describe('readRoles', () => {
  it('devuelve los roles del payload', () => {
    expect(readRoles(fakeJwt({ sub: '1', roles: ['admin', 'encargado'] }))).toEqual([
      'admin',
      'encargado',
    ]);
  });

  it('devuelve [] si el token no tiene el claim', () => {
    expect(readRoles(fakeJwt({ sub: '1' }))).toEqual([]);
  });

  it('descarta los elementos que no son string', () => {
    expect(readRoles(fakeJwt({ roles: ['admin', 7, null] }))).toEqual(['admin']);
  });

  it('devuelve [] con un token malformado en vez de tirar', () => {
    expect(readRoles('no-es-un-jwt')).toEqual([]);
  });
});

describe('SessionStore · datos derivados del token', () => {
  it('expone clubId y roles del access token', () => {
    const s = store();
    s.set({
      accessToken: fakeJwt({ sub: '1', clubId: '42', roles: ['admin'] }),
      refreshToken: 'r',
      mustChangePassword: false,
    });
    expect(s.clubId()).toBe('42');
    expect(s.roles()).toEqual(['admin']);
  });

  it('sobreviven un F5: salen del token rehidratado, no del login', () => {
    // Ésta es la razón de derivarlos del token y no de TenantContext, que sólo puebla
    // SessionFacade.login(): hydrate() corre en el constructor de la instancia nueva.
    store().set({
      accessToken: fakeJwt({ sub: '1', clubId: '42', roles: ['encargado'] }),
      refreshToken: 'r',
      mustChangePassword: false,
    });
    const otro = store();               // instancia nueva, mismo localStorage
    expect(otro.clubId()).toBe('42');
    expect(otro.roles()).toEqual(['encargado']);
  });

  it('sin sesión, clubId es null y roles es []', () => {
    const s = store();
    expect(s.clubId()).toBeNull();
    expect(s.roles()).toEqual([]);
  });
});
