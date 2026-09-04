import { describe, it, expect, beforeEach } from 'vitest';
import { GrupoItemsStore } from './grupo-items-store';

describe('GrupoItemsStore', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve [] para un grupo del que no sabe nada', () => {
    expect(new GrupoItemsStore().read('7')).toEqual([]);
  });

  it('round-trip por grupo, sin pisar a los vecinos', () => {
    const store = new GrupoItemsStore();
    store.write('7', ['1', '3']);
    store.write('8', ['2']);
    expect(store.read('7')).toEqual(['1', '3']);
    expect(store.read('8')).toEqual(['2']);
  });

  it('forget() borra sólo ese grupo', () => {
    const store = new GrupoItemsStore();
    store.write('7', ['1']);
    store.write('8', ['2']);
    store.forget('7');
    expect(store.read('7')).toEqual([]);
    expect(store.read('8')).toEqual(['2']);
  });

  it('un valor corrupto en storage devuelve [] en vez de tirar', () => {
    // La pista es decorativa: si el storage quedó sucio, la pantalla arranca sin pista y se
    // corrige al primer click. Tirar acá tumbaría el modal entero por un dato de adorno.
    localStorage.setItem('PipoFy:grupo-items:v1', '{no es json');
    expect(new GrupoItemsStore().read('7')).toEqual([]);
  });
});
