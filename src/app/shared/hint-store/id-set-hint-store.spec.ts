import { describe, it, expect, beforeEach } from 'vitest';
import { IdSetHintStore } from './id-set-hint-store';

/** Subclase mínima: la base es abstracta y lo único que fija una subclase es la clave. */
class TestStore extends IdSetHintStore {
  protected readonly key = 'test:hint:v1';
}

describe('IdSetHintStore', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve [] para un dueño del que no sabe nada', () => {
    expect(new TestStore().read('7')).toEqual([]);
  });

  it('round-trip por dueño, sin pisar a los vecinos', () => {
    const store = new TestStore();
    store.write('7', ['1', '3']);
    store.write('8', ['2']);
    expect(store.read('7')).toEqual(['1', '3']);
    expect(store.read('8')).toEqual(['2']);
  });

  it('forget() borra sólo a ese dueño', () => {
    const store = new TestStore();
    store.write('7', ['1']);
    store.write('8', ['2']);
    store.forget('7');
    expect(store.read('7')).toEqual([]);
    expect(store.read('8')).toEqual(['2']);
  });

  it('un valor corrupto en storage devuelve [] en vez de tirar', () => {
    // La pista es decorativa: si el storage quedó sucio, la pantalla arranca sin pista y se
    // corrige al primer click. Tirar acá tumbaría el modal entero por un dato de adorno.
    localStorage.setItem('test:hint:v1', '{no es json');
    expect(new TestStore().read('7')).toEqual([]);
  });

  it('un JSON válido que NO es objeto tampoco tira', () => {
    // `JSON.parse('null')` y `JSON.parse('[]')` no explotan pero tampoco son el Record que
    // esperamos: sin la guarda de tipo, `all()['7']` sobre null tira TypeError.
    localStorage.setItem('test:hint:v1', 'null');
    expect(new TestStore().read('7')).toEqual([]);
  });

  it('dos subclases con claves distintas no se pisan', () => {
    class OtroStore extends IdSetHintStore {
      protected readonly key = 'test:otro:v1';
    }
    new TestStore().write('7', ['1']);
    expect(new OtroStore().read('7')).toEqual([]);
  });
});
