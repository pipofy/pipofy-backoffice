import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GrupoItemsStore } from './grupo-items-store';

function store(): GrupoItemsStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), GrupoItemsStore] });
  return TestBed.inject(GrupoItemsStore);
}

describe('GrupoItemsStore', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve [] para un grupo del que no sabe nada', () => {
    expect(store().read('7')).toEqual([]);
  });

  it('round-trip por grupo, sin pisar a los vecinos', () => {
    const s = store();
    s.write('7', ['1', '3']);
    s.write('8', ['2']);
    expect(s.read('7')).toEqual(['1', '3']);
    expect(s.read('8')).toEqual(['2']);
  });

  it('forget() borra sólo ese grupo', () => {
    const s = store();
    s.write('7', ['1']);
    s.write('8', ['2']);
    s.forget('7');
    expect(s.read('7')).toEqual([]);
    expect(s.read('8')).toEqual(['2']);
  });

  it('un valor corrupto en storage devuelve [] en vez de tirar', () => {
    // La pista es decorativa: si el storage quedó sucio, la pantalla arranca sin pista y se
    // corrige al primer click. Tirar acá tumbaría el modal entero por un dato de adorno.
    localStorage.setItem('app:grupo-items:v1', '{no es json');
    expect(store().read('7')).toEqual([]);
  });
});
