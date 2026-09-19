import { describe, it, expect } from 'vitest';
import { catalogLabel } from './catalog-labels';

describe('catalogLabel', () => {
  it('traduce los valores del seed a etiquetas legibles', () => {
    // El seed guarda los nombres en snake_case (§4.8): no se puede mostrar
    // `polvo_ladrillo` en un select.
    expect(catalogLabel('polvo_ladrillo')).toBe('Polvo de ladrillo');
    expect(catalogLabel('sintetico')).toBe('Sintético');
    expect(catalogLabel('mantenimiento')).toBe('En mantenimiento');
  });

  it('humaniza un valor desconocido en vez de romper', () => {
    // Si el seed suma un valor nuevo, la UI lo muestra aceptable sin tocar código.
    expect(catalogLabel('cesped_natural')).toBe('Cesped natural');
  });
});

describe('catalogLabel — tipos de plan', () => {
  it('traduce los tres del seed', () => {
    expect(catalogLabel('mensual_grupal')).toBe('Mensual grupal');
    expect(catalogLabel('individual')).toBe('Individual');
    expect(catalogLabel('nivelacion')).toBe('Nivelación');
  });

  it('nivelacion necesita entrada explícita: el fallback pierde la tilde', () => {
    expect(catalogLabel('nivelacion')).not.toBe('Nivelacion');
  });
});

describe('catalogLabel — estados del alumno', () => {
  it('traduce los tres estados del seed', () => {
    expect(catalogLabel('active')).toBe('Activo');
    expect(catalogLabel('inactive')).toBe('Inactivo');
    expect(catalogLabel('pending_classification')).toBe('Sin clasificar');
  });

  it('pending_classification necesita entrada explícita: el fallback lo dejaría en inglés', () => {
    expect(catalogLabel('pending_classification')).not.toBe('Pending classification');
  });
});

describe('catalogLabel — nombres heredados de Object.prototype', () => {
  it('no devuelve miembros del prototipo', () => {
    // Con un objeto literal, `CATALOG_LABELS['constructor']` devolvía la función Object y el
    // `??` nunca se disparaba: la plantilla renderizaba "function Object() { [native code] }"
    // como etiqueta de superficie. TypeScript tipa eso como string, así que el compilador no
    // lo veía. Por eso el mapa es un Map. El backend manda estos nombres crudos.
    expect(catalogLabel('constructor')).toBe('Constructor');
    expect(catalogLabel('toString')).toBe('ToString');
    // No se afirma la etiqueta exacta: el fallback convierte los guiones bajos en espacios y
    // deja '  proto  '. Lo que importa es que sea un string y no el objeto heredado.
    expect(typeof catalogLabel('__proto__')).toBe('string');
    expect(catalogLabel('__proto__')).toContain('proto');
  });
});
