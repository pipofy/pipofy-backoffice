# Marca Pipofy y primitivos de estado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoptar el brandboard de Pipofy (paleta, tipografía, logo, favicon) y reemplazar los seis patrones distintos de vacío/error/carga por tres primitivos compartidos, ilustrados con esa marca.

**Architecture:** El color y la tipografía viven exclusivamente en `styles/tokens.css`, así que la re-marca es un cambio de tokens más un componente de logo. Los ~70 sitios de estado se colapsan en dos formas visuales — un bloque centrado (`app-placeholder`) y una barra inline (`app-notice`) — más un `app-field-error` que ya existe y sólo se promueve de `features/onboarding` a `shared/ui`. La exhaustividad del primitivo se garantiza con un `Record` completo de TypeScript, no con un `switch` con rama por defecto.

**Tech Stack:** Angular 20 standalone + zoneless + signals, Vitest + jsdom + TestBed, CSS con custom properties, `eslint-plugin-boundaries`.

**Spec:** `docs/superpowers/specs/2026-09-03-marca-y-placeholders-design.md`

## Global Constraints

- **Angular 20 standalone, zoneless, signals.** Nada de NgModules ni Zone.js. Todo componente lleva `ChangeDetectionStrategy.OnPush`, usa `inject()`, `input()`, `computed()`.
- **Capas impuestas por lint.** `shared/` sólo puede importar de `shared/`. Los primitivos de este plan viven en `shared/ui/` y por lo tanto **no pueden importar `DomainError` ni nada de `@domain`**: reciben strings ya formateados.
- **Alias, no rutas relativas largas:** `@shared/*`, `@domain/*`, `@data/*`, `@features/*`.
- **Idioma:** comentarios y copy de UI en **español**; `core/` en inglés. Estos primitivos viven en `shared/`, así que su copy y comentarios van en español.
- **Prettier:** `printWidth: 100`, `singleQuote: true`.
- **Todo `TestBed` lleva `provideZonelessChangeDetection()`** en los providers.
- **Sin librería de mocks:** los dobles son objetos planos casteados al contrato.
- **Simplificaciones deliberadas** se marcan con un comentario `ponytail:` que nombra el techo y la salida.
- **Regla de admisión a `styles/components.css`:** es vocabulario del design system (*qué es*, no *dónde va*) **y** tiene un consumidor real hoy.
- **Cada commit termina con:**
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- **Cada tarea corre `npm run lint` antes de commitear.** Es lo único que verifica los boundaries de capa.

---

### Task 1: Assets de marca a `public/brand/`

Los SVG del brandboard traen ~10KB de firma C2PA en base64 que no aporta nada al render. Se copian a `public/` (que Angular sirve en la raíz) sólo las dos piezas con consumidor real.

**Files:**
- Create: `public/brand/logo-horizontal.svg`
- Create: `public/brand/favicon.svg`
- Delete: `public/favicon.ico`
- Modify: `src/index.html:8`

**Interfaces:**
- Consumes: nada.
- Produces: las rutas `brand/logo-horizontal.svg` y `brand/favicon.svg`, servidas desde la raíz del sitio. Las consumen la Task 4 (brandmark) y este mismo task (favicon).

- [ ] **Step 1: Contar los nodos de dibujo de los originales**

Este es el chequeo de seguridad del `sed` que viene después: si el corte de metadata se come geometría, el conteo baja.

```bash
for f in assets/logos/03-logo-horizontal.svg assets/07d-favicon.svg; do
  echo "$f: $(grep -o '<path\|<circle\|<ellipse\|<rect\|<polygon' "$f" | wc -l | tr -d ' ') nodos"
done
```

Anotá los dos números. Esperado: el horizontal tiene más de 10, el favicon más de 5.

- [ ] **Step 2: Copiar los dos archivos sin la metadata C2PA**

```bash
mkdir -p public/brand
sed 's|<metadata>.*</metadata>||' assets/logos/03-logo-horizontal.svg > public/brand/logo-horizontal.svg
sed 's|<metadata>.*</metadata>||' assets/07d-favicon.svg               > public/brand/favicon.svg
```

- [ ] **Step 3: Verificar que no se perdió geometría**

```bash
for f in public/brand/logo-horizontal.svg public/brand/favicon.svg; do
  echo "$f: $(grep -o '<path\|<circle\|<ellipse\|<rect\|<polygon' "$f" | wc -l | tr -d ' ') nodos, $(wc -c < "$f" | tr -d ' ') bytes"
  python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$f'); print('  parsea OK')"
done
```

Esperado: los mismos conteos de nodos del Step 1, tamaños de ~5KB y ~1KB, y "parsea OK" en los dos. **Si un conteo bajó, el `sed` se comió geometría — parar y cortar el bloque a mano.**

- [ ] **Step 4: Apuntar el favicon al SVG nuevo**

En `src/index.html`, reemplazar la línea 8:

```html
  <link rel="icon" type="image/x-icon" href="favicon.ico">
```

por:

```html
  <link rel="icon" type="image/svg+xml" href="brand/favicon.svg">
```

- [ ] **Step 5: Borrar el favicon del scaffold**

```bash
rm public/favicon.ico
```

- [ ] **Step 6: Verificar que el build sigue verde**

```bash
npm run build
```

Esperado: build exitoso. `public/brand/` aparece copiado en `dist/`.

- [ ] **Step 7: Commit**

```bash
git add public src/index.html
git commit -m "$(cat <<'EOF'
feat(marca): assets de logo y favicon de Pipofy en public/brand

Copia el logo horizontal y el favicon del brandboard sin el bloque
<metadata> con la firma C2PA (base64, ~10KB por archivo, sin efecto en
el render). Verificado que el conteo de nodos de dibujo no cambió.

Baja public/favicon.ico, que era el del scaffold de Angular.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Paleta del brandboard

Cambio puramente visual, sin cobertura de tests. Va **solo en su commit** para poder revertirlo sin arrastrar nada más.

**Files:**
- Modify: `styles/tokens.css:16-19` (paleta base), `:56-66` (derivados)

**Interfaces:**
- Consumes: nada.
- Produces: los tokens `--color-primary`, `--color-primary-hover`, `--color-primary-strong`, `--color-primary-soft`, `--color-on-primary-soft`, `--color-secondary`, `--color-foreground`, `--color-background`, `--color-muted`, `--color-border`, `--color-border-strong`, `--color-fg-muted`, `--color-fg-subtle`, `--color-ring`, la familia `--color-accent-*` y el nuevo `--color-destructive-soft-border`. Los consumen todas las tareas siguientes.

- [ ] **Step 1: Reemplazar el bloque de paleta base**

En `styles/tokens.css`, reemplazar las líneas 16-19:

```css
  /* ── Paleta de MASTER.md ── */
  --color-primary:#2563EB; --color-on-primary:#FFFFFF; --color-secondary:#3B82F6;
  --color-accent:#059669; --color-background:#F8FAFC; --color-foreground:#0F172A;
  --color-muted:#F1F5FD; --color-border:#E4ECFC; --color-destructive:#DC2626; --color-ring:#2563EB;
```

por:

```css
  /* ── Paleta del brandboard Pipofy (assets/LEEME.md) ──
     Primary #082658 = "textos, la P, fondos oscuros".
     Web Blue #2267AC = "enlaces y acentos de interfaz" → es el --color-primary de la UI.
     Accent #6DB5E5 da 2.24:1 sobre blanco: SÓLO sobre navy, nunca texto claro.
     Neutral #ABB4BD da 2.10:1 sobre blanco: SÓLO bordes, nunca texto.
     --color-destructive y la familia --color-warning-* NO son de marca: son
     semánticos y quedan como estaban. */
  --color-primary:#2267AC; --color-on-primary:#FFFFFF; --color-secondary:#2E78C0;
  --color-accent:#2E78C0; --color-background:#F7F9FC; --color-foreground:#082658;
  --color-muted:#EEF3F9; --color-border:#DDE5EE; --color-destructive:#DC2626; --color-ring:#2267AC;
```

- [ ] **Step 2: Reemplazar los derivados**

En el mismo archivo, reemplazar el bloque de derivados (líneas 56-73, desde `--color-surface:#FFFFFF;` hasta `--color-warning-soft-border:#F4DCA0;`) por:

```css
  --color-surface:#FFFFFF; --color-surface-2:var(--color-muted);
  --color-fg:var(--color-foreground);   /* 14.70:1 sobre blanco, 13.94:1 sobre background */
  --color-fg-muted:#4A5B73;             /*  6.92:1 sobre blanco, 6.20:1 sobre muted */
  --color-fg-subtle:#5A6B82;            /*  5.44:1 sobre blanco, 4.88:1 sobre muted */

  --color-primary-hover:#1B5595;        /* blanco: 7.55:1 — tono medio del degradado del icono */
  --color-primary-strong:#082658;       /* blanco: 14.70:1 — Primary de marca, superficies oscuras */
  --color-primary-soft:#EAF2FA; --color-on-primary-soft:#1B5595;   /* 6.68:1 sobre soft */

  /* ponytail: el estado "ok" y el color primario son ahora el mismo azul — un badge
     "confirmado" no se distingue de un botón primario. Es la consecuencia aceptada de
     "todo azul": el brandboard no tiene verde. Si esa distinción hace falta, entra una
     familia --color-success-* con un verde armonizado al navy y estos alias apuntan
     ahí; los 17 consumidores de --color-accent-* no cambian. */
  --color-accent-strong:#2267AC;        /* blanco: 5.83:1 */
  --color-accent-hover:#1B5595;         /* blanco: 7.55:1 */
  --color-accent-mark:var(--color-accent);   /* sólo marcas/barras */
  --color-accent-soft:#EAF2FA; --color-on-accent-soft:#1B5595;    /* 6.68:1 sobre soft */
  --color-accent-soft-border:#C5DCF0;   /* el borde del par soft (.sess.open) */

  --color-destructive-hover:#B91C1C;
  --color-destructive-soft:#FEECEC; --color-on-destructive-soft:#B91C1C; /* 5.68:1 */
  --color-destructive-soft-border:#F7CECE;  /* el borde del par soft (.notice.bad) */

  --color-warning:#B45309; --color-warning-mark:#F59E0B;
  --color-warning-soft:#FEF3C7; --color-on-warning-soft:#78350F;   /* 8.15:1 */
  --color-warning-soft-border:#F4DCA0;  /* el borde del par soft (.sess.wait, .notice.hold) */
```

- [ ] **Step 3: Actualizar `--color-border-strong`**

En `styles/tokens.css`, reemplazar:

```css
  --color-border-strong:#E2E8F0;  /* borde del spec .input de MASTER */
```

por:

```css
  /* Neutral #ABB4BD del brandboard, tal cual. 2.10:1 sobre blanco: bordes, nunca texto. */
  --color-border-strong:#ABB4BD;
```

- [ ] **Step 4: Actualizar la cabecera del archivo**

Reemplazar `SETPOINT · TOKENS COMPARTIDOS` en el comentario de la línea 2 por `PIPOFY · TOKENS COMPARTIDOS`.

- [ ] **Step 5: Verificar que no quedó ningún hex de la paleta vieja**

```bash
grep -n '2563EB\|3B82F6\|059669\|1D4ED8\|1E3A8A\|047857\|036B4B\|EFF4FE\|E7F6EF\|BEE6D4\|0F172A\|F8FAFC\|F1F5FD\|E4ECFC\|E2E8F0\|475569\|586675' styles/tokens.css
```

Esperado: **sin salida**.

- [ ] **Step 6: Correr los tests y el lint**

```bash
npm test && npm run lint
```

Esperado: todo verde. Ningún test mira colores — por eso este commit va solo.

- [ ] **Step 7: Revisión visual de los 17 consumidores de `--color-accent-*`**

```bash
npm start
```

Abrir el dashboard y una página de lista. Verificar que los badges y barras que antes eran verdes ahora son azules y **siguen siendo legibles** (no azul sobre azul). Los 17 sitios:

```bash
grep -rn -- '--color-accent' src/app styles | grep -v tokens.css
```

- [ ] **Step 8: Commit**

```bash
git add styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(marca): paleta del brandboard Pipofy

Web Blue #2267AC como --color-primary (el brandboard lo asigna a
"enlaces y acentos de interfaz"), navy #082658 como foreground y
--color-primary-strong. Contrastes AA verificados y anotados.

La familia --color-accent-* pierde el verde y queda como alias del azul,
con un ponytail: que nombra el techo — "ok" y primario ya no se
distinguen — y la salida.

Va solo en su commit: ningún test cubre colores.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Tipografía Poppins

**Files:**
- Modify: `src/index.html:11`
- Modify: `styles/tokens.css:32-34`

**Interfaces:**
- Consumes: nada.
- Produces: `--font-heading`, `--font-body`, `--font-mono` con valores nuevos. Los consume todo el CSS existente.

- [ ] **Step 1: Cambiar el `<link>` de Google Fonts**

En `src/index.html`, reemplazar la línea 11:

```html
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

por:

```html
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

`&display=swap` se mantiene: sin él el texto queda invisible mientras baja la fuente.

- [ ] **Step 2: Cambiar los tokens de tipografía**

En `styles/tokens.css`, reemplazar las líneas 32-34:

```css
  --font-heading:"Fira Code",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --font-body:"Fira Sans","Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
  --font-mono:var(--font-heading);
```

por:

```css
  /* El brandboard nombra "Pipofy Sans", que no existe publicada. assets/LEEME.md
     resuelve en Poppins (SIL OFL), geométrica y libre. */
  --font-heading:"Poppins","Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
  --font-body:var(--font-heading);
  /* --font-mono deja de ser --font-heading: Poppins es proporcional y .mono lo usa
     para tabular-nums en ids y números, donde una proporcional rompe la alineación.
     Stack de sistema: no descarga nada. */
  --font-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
```

- [ ] **Step 3: Verificar que no quedó ninguna referencia a Fira**

```bash
grep -rn 'Fira' src/ styles/ --include='*.css' --include='*.html'
```

Esperado: **sin salida**. (Las maquetas estáticas de la raíz no cuentan: no son parte del build.)

- [ ] **Step 4: Correr tests y lint**

```bash
npm test && npm run lint
```

- [ ] **Step 5: Revisión visual**

```bash
npm start
```

Verificar en el dashboard que los números de las tarjetas (`.mono`, `.count`) sigan alineados en columna — eso confirma que `--font-mono` quedó monoespaciada de verdad.

- [ ] **Step 6: Commit**

```bash
git add src/index.html styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(marca): Poppins en lugar de Fira

--font-heading y --font-body pasan a Poppins, la fuente que resuelve
assets/LEEME.md por el "Pipofy Sans" del brandboard, que no existe
publicada.

--font-mono deja de apuntar a --font-heading y pasa a stack de sistema:
Poppins es proporcional y .mono lo usa para tabular-nums. Neto: se baja
una familia en vez de dos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Brandmark con el logo real

**Files:**
- Modify: `src/app/shared/ui/brandmark.component.ts`
- Modify: `styles/tokens.css` (bloque `═══ MARCA ═══`, líneas 116-125)

**Interfaces:**
- Consumes: `brand/logo-horizontal.svg` (Task 1).
- Produces: `BrandmarkComponent` con la misma API pública que hoy — `link` (default `'/'`) y `ariaLabel`. Los 6 call sites existentes no cambian.

- [ ] **Step 1: Reemplazar el template del componente**

Reemplazar el contenido completo de `src/app/shared/ui/brandmark.component.ts` por:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * El lockup de marca. El texto "Pipofy" ya está convertido a trazados dentro del
 * SVG, así que no se duplica en HTML: dos copias se desalinearían. El alt mantiene
 * el nombre accesible y el aria-label del enlace describe el destino.
 *
 * ponytail: un <img> no hereda currentColor, así que sobre una superficie oscura el
 * logo navy desaparece. Hoy no hay ninguna. Cuando la haya, la salida es la variante
 * 01b-isotipo-blanco del brandboard, que todavía no está en assets/.
 */
@Component({
  selector: 'app-brandmark',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brandmark" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <img class="bm-img" src="brand/logo-horizontal.svg" alt="Pipofy" />
    </a>
  `,
})
export class BrandmarkComponent {
  readonly link = input<string>('/');
  readonly ariaLabel = input<string>('Pipofy · ir al panel');
}
```

- [ ] **Step 2: Agregar la regla del `<img>` y conservar las viejas**

En `styles/tokens.css`, dentro del bloque `═══ MARCA (lockup compartido) ═══`, agregar después de la regla `.brandmark`:

```css
.brandmark .bm-img{height:36px;width:auto;display:block}
```

**No borrar** `.bm-logo`, `.bm-name` ni `.bm-sub`: las siguen usando `index-v2.html` y `onboarding.html`, que son maquetas de referencia fuera del build. Agregar arriba de esas tres reglas el comentario:

```css
/* .bm-logo / .bm-name / .bm-sub ya no las usa la app: BrandmarkComponent renderiza
   un <img>. Se conservan porque index-v2.html y onboarding.html —maquetas estáticas
   de la raíz, fuera del build— siguen siendo consumidores reales. */
```

- [ ] **Step 3: Verificar que ningún componente Angular usa las clases viejas**

```bash
grep -rn 'bm-logo\|bm-name\|bm-sub' src/
```

Esperado: **sin salida**.

- [ ] **Step 4: Correr tests y lint**

```bash
npm test && npm run lint
```

- [ ] **Step 5: Revisión visual en las tres superficies del brandmark**

```bash
npm start
```

Verificar el logo en: la sidebar del shell (`/dashboard`), el masthead de `/login`, y el header de `/onboarding`. La sidebar mide 244px, así que el logo horizontal tiene que entrar sin desbordar.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/ui/brandmark.component.ts styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(marca): brandmark con el logo horizontal de Pipofy

Reemplaza el SVG inline genérico y el texto "SetPoint · Club Ops" por el
logo del brandboard. El texto ya está en trazados dentro del SVG.

Las reglas .bm-logo/.bm-name/.bm-sub se conservan: las maquetas estáticas
de la raíz siguen siendo consumidores reales.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `app-placeholder`

El bloque centrado. TDD: el spec del mapeo `tone → rol ARIA` se escribe antes que el componente.

**Files:**
- Create: `src/app/shared/ui/placeholder.component.ts`
- Test: `src/app/shared/ui/placeholder.component.spec.ts`

**Interfaces:**
- Consumes: los tokens de color de la Task 2.
- Produces:
  - `export type PlaceholderTone = 'empty' | 'error' | 'loading' | 'wip'`
  - `export class PlaceholderComponent` con inputs `tone: PlaceholderTone` (default `'empty'`), `size: 'inline' | 'page'` (default `'inline'`), `title: string` (**required**), `body: string` (default `''`), y un `<ng-content>` para la acción.
  - Selector `app-placeholder`.

  Lo usan las Tasks 8 a 15.

- [ ] **Step 1: Escribir el spec que falla**

Crear `src/app/shared/ui/placeholder.component.spec.ts`:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlaceholderComponent, type PlaceholderTone } from './placeholder.component';

/** Monta el primitivo con un tone y devuelve el elemento que lleva el rol. */
async function mount(tone: PlaceholderTone) {
  await TestBed.configureTestingModule({
    imports: [PlaceholderComponent],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();

  const fixture = TestBed.createComponent(PlaceholderComponent);
  fixture.componentRef.setInput('tone', tone);
  fixture.componentRef.setInput('title', 'Nada por acá');
  await fixture.whenStable();
  return fixture;
}

describe('PlaceholderComponent', () => {
  // El mapeo tone → rol ARIA es la única lógica del primitivo, y es la que arregla
  // los 12 textos de carga que hoy no se anuncian a lectores de pantalla.
  const CASOS: ReadonlyArray<[PlaceholderTone, string | null]> = [
    ['empty', null],
    ['error', 'alert'],
    ['loading', 'status'],
    ['wip', null],
  ];

  for (const [tone, rol] of CASOS) {
    it(`tone="${tone}" declara role=${rol ?? 'ninguno'}`, async () => {
      const fixture = await mount(tone);
      const bloque = fixture.nativeElement.querySelector('.ph') as HTMLElement;

      expect(bloque).toBeTruthy();
      expect(bloque.getAttribute('role')).toBe(rol);
    });
  }

  it('muestra el title y el body', async () => {
    const fixture = await mount('empty');
    fixture.componentRef.setInput('body', 'Cargá el primero desde el botón de arriba.');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Nada por acá');
    expect(fixture.nativeElement.textContent).toContain('Cargá el primero');
  });

  it('sin body no renderiza el párrafo de body', async () => {
    const fixture = await mount('empty');

    expect(fixture.nativeElement.querySelector('.ph-body')).toBeNull();
  });

  it('size="page" marca el bloque, size="inline" no', async () => {
    const fixture = await mount('empty');
    const bloque = fixture.nativeElement.querySelector('.ph') as HTMLElement;
    expect(bloque.classList.contains('ph-page')).toBe(false);

    fixture.componentRef.setInput('size', 'page');
    await fixture.whenStable();
    expect(bloque.classList.contains('ph-page')).toBe(true);
  });

  it('la ilustración está oculta a lectores de pantalla', async () => {
    const fixture = await mount('error');
    const art = fixture.nativeElement.querySelector('.ph-art') as HTMLElement;

    expect(art.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: Correr el spec para verificar que falla**

```bash
npx ng test --include src/app/shared/ui/placeholder.component.spec.ts
```

Esperado: **FAIL** — no resuelve el módulo `./placeholder.component`.

- [ ] **Step 3: Escribir el componente**

Crear `src/app/shared/ui/placeholder.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Los cuatro estados que un bloque centrado puede representar. */
export type PlaceholderTone = 'empty' | 'error' | 'loading' | 'wip';

/**
 * Rol ARIA por tono. Es un Record COMPLETO, no un switch con rama por defecto:
 * agregar un tone rompe el build hasta que declare su rol, igual que
 * domainErrorMessage (core/domain/errors.ts) rompe el build al agregar un kind sin
 * copy. Ese mapeo es lo que hace que un estado de carga se anuncie solo.
 */
const ROLE: Record<PlaceholderTone, 'alert' | 'status' | null> = {
  empty: null,
  error: 'alert',
  loading: 'status',
  wip: null,
};

/**
 * El bloque centrado de vacío / error / carga / en-construcción.
 *
 * `size='inline'` (default) reproduce la métrica del viejo `.a-empty` y es lo que va
 * dentro de una tabla o un modal; `size='page'` es el bloque de pantalla completa.
 *
 * Ojo: shell.component.css redefine la escala --text-* en su :host, así que este
 * primitivo renderiza más denso dentro del shell que fuera. Verificá los dos.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph" [class.ph-page]="size() === 'page'" [attr.role]="role()">
      <span class="ph-art" aria-hidden="true">
        <!-- Sin @default: la exhaustividad la garantiza el Record ROLE, no el template. -->
        @switch (tone()) {
          @case ('empty') {
            <svg viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <circle cx="9.6" cy="7.4" r="1" fill="currentColor" opacity=".45" />
              <circle cx="12" cy="10.2" r="1" fill="currentColor" opacity=".45" />
              <circle cx="14.4" cy="7.4" r="1" fill="currentColor" opacity=".45" />
              <path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            </svg>
          }
          @case ('error') {
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M2 17h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5" />
              <circle cx="17" cy="9" r="4.6" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <path d="M13.4 6.2c1.6 1.6 1.6 4 0 5.6M20.6 6.2c-1.6 1.6-1.6 4 0 5.6" stroke="currentColor" stroke-width="1.1" opacity=".55" />
              <path d="M4 20.5c1.6-3 3.6-5.2 6.2-6.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 2.6" opacity=".55" />
            </svg>
          }
          @case ('loading') {
            <svg viewBox="0 0 24 24" fill="none">
              <g class="ph-roll">
                <circle cx="12" cy="11" r="5.4" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
                <path d="M7.7 7.7c1.9 1.9 1.9 4.7 0 6.6M16.3 7.7c-1.9 1.9-1.9 4.7 0 6.6" stroke="currentColor" stroke-width="1.1" opacity=".55" />
              </g>
              <path d="M4 19.5h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />
            </svg>
          }
          @case ('wip') {
            <svg viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              <path d="M3.5 11.5h17" stroke="var(--color-warning-mark)" stroke-width="3" stroke-linecap="round" />
              <path d="M5 11.5h1.6M9 11.5h1.6M13 11.5h1.6M17 11.5h1.6" stroke="var(--color-surface)" stroke-width="3" />
            </svg>
          }
        }
      </span>
      <p class="ph-title">{{ title() }}</p>
      @if (body()) {
        <p class="ph-body">{{ body() }}</p>
      }
      <!-- Sin whitespace entre las tags: .ph-action:empty depende de que el div
           quede realmente vacío cuando no hay acción proyectada. -->
      <div class="ph-action"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .ph {
        padding: var(--space-lg);
        text-align: center;
        color: var(--color-fg-subtle);
        font-size: var(--text-2xs);
      }
      .ph-art svg {
        width: 26px;
        height: 26px;
        display: block;
        margin: 0 auto var(--space-sm);
        color: var(--color-primary);
        opacity: 0.75;
      }
      .ph-title {
        font-weight: 600;
        color: var(--color-fg-muted);
      }
      .ph-body {
        margin-top: var(--space-xs);
        max-width: 44ch;
        margin-inline: auto;
        line-height: var(--leading-snug);
      }
      .ph-action:empty {
        display: none;
      }
      .ph-action {
        margin-top: var(--space-md);
      }

      .ph.ph-page {
        max-width: 420px;
        margin: var(--space-3xl) auto;
        font-size: var(--text-sm);
      }
      .ph-page .ph-art svg {
        width: 72px;
        height: 72px;
        margin-bottom: var(--space-md);
      }
      .ph-page .ph-title {
        font-size: var(--text-lg);
        color: var(--color-fg);
      }

      /* El @media prefers-reduced-motion de tokens.css:108 anula esto sin código extra. */
      .ph-roll {
        transform-origin: 12px 11px;
        animation: ph-roll 900ms linear infinite;
      }
      @keyframes ph-roll {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PlaceholderComponent {
  readonly tone = input<PlaceholderTone>('empty');
  readonly size = input<'inline' | 'page'>('inline');
  readonly title = input.required<string>();
  readonly body = input('');

  protected readonly role = computed(() => ROLE[this.tone()]);
}
```

- [ ] **Step 4: Correr el spec para verificar que pasa**

```bash
npx ng test --include src/app/shared/ui/placeholder.component.spec.ts
```

Esperado: **PASS**, 8 tests (4 del mapeo de rol + 4 del resto).

- [ ] **Step 5: Verificar la exhaustividad del Record**

Agregar temporalmente `'nuevo'` a la unión `PlaceholderTone` y correr:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Esperado: **error de tipo** en `ROLE`, señalando que falta la propiedad `nuevo`. Revertir el cambio. Este step confirma que el guardrail funciona; si compila, el `Record` está mal escrito.

- [ ] **Step 6: Lint y commit**

```bash
npm run lint
git add src/app/shared/ui/placeholder.component.ts src/app/shared/ui/placeholder.component.spec.ts
git commit -m "$(cat <<'EOF'
feat(shared): app-placeholder, el bloque centrado de estado

Un primitivo para vacío, error, carga y en-construcción, con las cuatro
ilustraciones dibujadas con la geometría del isotipo del brandboard.

El mapeo tone → rol ARIA va en un Record completo, no en un switch con
default: agregar un tone rompe el build hasta que declare su rol. Es lo
que hace que un estado de carga se anuncie solo, que es el bug que hoy
tienen 12 de los 15 textos de "Cargando…".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `app-notice`

La barra inline. Hoy los 30 errores usan `.notice.hold`, que es la paleta *warning*: un error de red se ve amarillo. Este task agrega el colorway que faltaba.

**Files:**
- Create: `src/app/shared/ui/notice.component.ts`
- Modify: `styles/components.css:305` (agregar `.notice.bad` después de `.notice.hold`)

**Interfaces:**
- Consumes: `--color-destructive-soft`, `--color-on-destructive-soft` y `--color-destructive-soft-border` (Task 2).
- Produces:
  - `export type NoticeTone = 'bad' | 'hold' | 'ok'`
  - `export class NoticeComponent`, selector `app-notice`, input `tone: NoticeTone` (default `'bad'`), contenido por `<ng-content>`.

  Lo usan las Tasks 10 a 15.

- [ ] **Step 1: Agregar el colorway a `components.css`**

El comentario de `components.css:298-302` documenta la regla: "Para sumar un colorway: agregá `.notice.<variante>` cuando llegue su consumidor." El consumidor llega en la Task 10. Insertar después de la línea de `.notice.hold`:

```css
.notice.bad{background:var(--color-destructive-soft);border:1px solid var(--color-destructive-soft-border);color:var(--color-on-destructive-soft)}
```

- [ ] **Step 2: Escribir el componente**

Crear `src/app/shared/ui/notice.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Los tres colorways de la barra inline, alineados con .notice.* de components.css. */
export type NoticeTone = 'bad' | 'hold' | 'ok';

/**
 * Rol ARIA por tono. Record completo por el mismo motivo que en app-placeholder:
 * agregar un tone rompe el build hasta que declare su rol.
 *
 * El primitivo es el DUEÑO del rol. Los call sites NO declaran role="alert": si lo
 * hicieran, el lector de pantalla anunciaría dos veces.
 */
const ROLE: Record<NoticeTone, 'alert' | 'status'> = {
  bad: 'alert',
  hold: 'alert',
  ok: 'status',
};

/**
 * La barra inline de aviso. `bad` es un error, `hold` una advertencia (cupos, esperas)
 * y `ok` una confirmación. Antes de este primitivo los errores se pintaban con `hold`,
 * o sea con la paleta warning: un error de red se veía igual que un aviso de cupo.
 */
@Component({
  selector: 'app-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="notice" [class]="tone()" [attr.role]="role()"><ng-content /></p>
  `,
})
export class NoticeComponent {
  readonly tone = input<NoticeTone>('bad');

  protected readonly role = computed(() => ROLE[this.tone()]);
}
```

`[class]="tone()"` se fusiona con el `class="notice"` estático: Angular no lo reemplaza.

- [ ] **Step 3: Verificar que compila y que el lint pasa**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run lint
```

Esperado: sin errores. El componente no lleva spec propio: es markup sin ramas y lo van a ejercitar los specs de página de las Tasks 10 a 15.

- [ ] **Step 4: Correr los tests**

```bash
npm test
```

Esperado: todo verde, sin cambios de conteo.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/notice.component.ts styles/components.css
git commit -m "$(cat <<'EOF'
feat(shared): app-notice y el colorway .notice.bad

La barra inline de aviso, con el rol ARIA en un Record completo. El
primitivo es el dueño del rol: los call sites dejan de declararlo, así
no se anuncia dos veces.

.notice.bad es el colorway que faltaba: hasta ahora los errores usaban
.notice.hold, que es la paleta warning.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Promover `app-field-error` a `shared/ui`

El componente ya existe con 9 usos, pero vive en `features/onboarding/`. `eslint-plugin-boundaries` prohíbe que otra feature lo importe — y por eso auth se dibujó su propio `.field-err` dos veces.

**Files:**
- Create: `src/app/shared/ui/field-error.component.ts` (movido)
- Create: `src/app/shared/ui/field-error.component.spec.ts` (movido)
- Delete: `src/app/features/onboarding/components/field-error.component.ts`
- Delete: `src/app/features/onboarding/components/field-error.component.spec.ts`
- Modify: los archivos que lo importan (los encuentra el Step 2)

**Interfaces:**
- Consumes: nada.
- Produces: `FieldErrorComponent` importable desde `@shared/ui/field-error.component`. Misma API: inputs `show: boolean` (default `false`) y `message: string` (default `''`), selector `app-field-error`. La usa la Task 15.

- [ ] **Step 1: Mover los dos archivos con git**

```bash
git mv src/app/features/onboarding/components/field-error.component.ts \
       src/app/shared/ui/field-error.component.ts
git mv src/app/features/onboarding/components/field-error.component.spec.ts \
       src/app/shared/ui/field-error.component.spec.ts
```

- [ ] **Step 2: Encontrar y arreglar los imports**

```bash
grep -rln 'field-error.component' src/app
```

En cada archivo de la lista, reemplazar la ruta relativa (`./field-error.component`, `../components/field-error.component`, etc.) por el alias:

```ts
import { FieldErrorComponent } from '@shared/ui/field-error.component';
```

En `src/app/shared/ui/field-error.component.spec.ts`, el import queda relativo porque el spec está al lado del componente:

```ts
import { FieldErrorComponent } from './field-error.component';
```

- [ ] **Step 3: Verificar que no quedó ninguna referencia a la ruta vieja**

```bash
grep -rn 'onboarding/components/field-error' src/app
```

Esperado: **sin salida**.

- [ ] **Step 4: Correr lint y tests**

```bash
npm run lint && npm test
```

El lint es lo que verifica de verdad este task: si algún archivo quedó importando de `features/onboarding`, `eslint-plugin-boundaries` lo marca como error de capa.

- [ ] **Step 5: Commit**

```bash
git add -A src/app
git commit -m "$(cat <<'EOF'
refactor(shared): promover app-field-error de onboarding a shared/ui

El componente ya existía con 9 usos, pero vivía dentro de una feature, y
los boundaries de capa prohíben que otra feature lo importe. Por eso auth
se dibujó su propio .field-err dos veces.

Sin cambios de código: sólo la ubicación y los imports.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Ruta 404

Hoy `app.routes.ts` no tiene wildcard: `/asdf` no matchea nada y renderiza pantalla en blanco, sin shell ni mensaje.

**Files:**
- Create: `src/app/shared/ui/not-found-page.component.ts`
- Test: `src/app/shared/ui/not-found-page.component.spec.ts`
- Modify: `src/app/app.routes.ts` (último hijo del shell, después del `redirectTo`)

**Interfaces:**
- Consumes: `PlaceholderComponent` (Task 5).
- Produces: `NotFoundPageComponent`, cargado lazy desde la ruta `**`.

- [ ] **Step 1: Escribir el spec que falla**

Crear `src/app/shared/ui/not-found-page.component.spec.ts`:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundPageComponent } from './not-found-page.component';

describe('NotFoundPageComponent', () => {
  it('explica que la página no existe y ofrece volver al panel', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotFoundPageComponent);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No encontramos esta página');

    // El bloque es el de pantalla completa y se anuncia como alerta.
    const bloque = el.querySelector('.ph') as HTMLElement;
    expect(bloque.classList.contains('ph-page')).toBe(true);
    expect(bloque.getAttribute('role')).toBe('alert');

    const volver = el.querySelector('a[href="/dashboard"]');
    expect(volver).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el spec para verificar que falla**

```bash
npx ng test --include src/app/shared/ui/not-found-page.component.spec.ts
```

Esperado: **FAIL** — no resuelve `./not-found-page.component`.

- [ ] **Step 3: Escribir el componente**

Crear `src/app/shared/ui/not-found-page.component.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * La ruta `**`. Cuelga del shell, así que llega con la sidebar puesta y el usuario
 * puede irse a otro lado; y como el shell está detrás de authGuard, una URL
 * desconocida sin sesión redirige al login antes de llegar acá.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [PlaceholderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-placeholder
      tone="error"
      size="page"
      title="No encontramos esta página"
      body="El enlace puede estar viejo o mal escrito."
    >
      <a class="btn btn-primary" routerLink="/dashboard">Volver al panel</a>
    </app-placeholder>
  `,
})
export class NotFoundPageComponent {}
```

- [ ] **Step 4: Correr el spec para verificar que pasa**

```bash
npx ng test --include src/app/shared/ui/not-found-page.component.spec.ts
```

Esperado: **PASS**.

- [ ] **Step 5: Cablear la ruta wildcard**

En `src/app/app.routes.ts`, dentro de `children` del shell, reemplazar:

```ts
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
```

por:

```ts
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      // La wildcard cuelga del shell a propósito: la URL desconocida llega con la
      // sidebar puesta, y sin sesión el authGuard del shell la manda al login antes.
      {
        path: '**',
        loadComponent: () =>
          import('@shared/ui/not-found-page.component').then((m) => m.NotFoundPageComponent),
        data: { title: 'Página no encontrada', crumb: 'Error' },
      },
```

- [ ] **Step 6: Verificar en el navegador**

```bash
npm start
```

Navegar a `http://localhost:4200/asdf` **con sesión iniciada**: tiene que aparecer el shell con la sidebar y el placeholder. Cerrar sesión y volver a `/asdf`: tiene que redirigir al login.

- [ ] **Step 7: Lint, tests y commit**

```bash
npm run lint && npm test
git add src/app/shared/ui/not-found-page.component.ts src/app/shared/ui/not-found-page.component.spec.ts src/app/app.routes.ts
git commit -m "$(cat <<'EOF'
feat(routing): ruta 404 dentro del shell

Hasta ahora una URL desconocida no matcheaba ninguna ruta y renderizaba
pantalla en blanco, sin shell ni mensaje.

La wildcard cuelga del shell para que la página llegue con la sidebar, y
sin sesión el authGuard la manda al login antes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Migrar `en-construccion` y el dashboard

Dos consumidores chicos y sin modales, buenos para validar los primitivos antes de la migración masiva.

**Files:**
- Modify: `src/app/shared/ui/en-construccion.component.ts`
- Modify: `src/app/features/dashboard/pages/dashboard-page.component.html:2-4`
- Modify: `src/app/features/dashboard/pages/dashboard-page.component.ts` (agregar `errorText()`)
- Modify: `src/app/features/dashboard/pages/dashboard-page.component.css:4` (borrar `.dash-status`)
- Modify: `src/app/features/dashboard/components/court-grid.component.ts:22-26`
- Modify: `src/app/features/dashboard/components/court-grid.component.css:3` (borrar `.grid-empty`)
- Modify: `src/app/features/dashboard/components/waitlist-card.component.ts:22-23`
- Test: los specs de dashboard y court-grid que asserten sobre `.dash-status`, `.grid-empty` o "Cargando"

**Interfaces:**
- Consumes: `PlaceholderComponent` (Task 5), `domainErrorMessage` de `@domain/errors`.
- Produces: nada nuevo.

- [ ] **Step 1: Reemplazar `en-construccion`**

Reemplazar el contenido de `src/app/shared/ui/en-construccion.component.ts` por:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-en-construccion',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-placeholder
      tone="wip"
      size="page"
      [title]="title"
      body="Esta sección todavía está en construcción."
    />
  `,
})
export class EnConstruccionComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title: string =
    (this.route.snapshot.data['title'] as string | undefined) ?? 'En construcción';
}
```

Se borran los `styles: []` propios: el primitivo los reemplaza.

- [ ] **Step 2: Correr el spec de `en-construccion`**

```bash
npx ng test --include src/app/shared/ui/en-construccion.component.spec.ts
```

Esperado: **PASS sin tocar el spec**. El spec assertea texto visible (`'Grupos y clases'` y `'construcción'`), no clases — que es exactamente la regla del §6.3 del spec, y por eso sobrevive al refactor.

- [ ] **Step 3: Migrar el chain del dashboard**

En `src/app/features/dashboard/pages/dashboard-page.component.html`, reemplazar las líneas 2-4:

```html
  <p class="dash-status">Cargando panel…</p>
} @else if (facade.error(); as err) {
  <p class="dash-status" role="alert">No se pudo cargar el panel ({{ err.kind }}).</p>
```

por:

```html
  <app-placeholder tone="loading" size="page" title="Cargando panel…" />
} @else if (facade.error()) {
  <app-placeholder tone="error" size="page" title="No se pudo cargar el panel" [body]="errorText()" />
```

Agregar `PlaceholderComponent` a los `imports` del componente.

- [ ] **Step 4: Agregar `errorText()` al dashboard**

En `src/app/features/dashboard/pages/dashboard-page.component.ts`, agregar el import y el método:

```ts
import { domainErrorMessage } from '@domain/errors';
```

```ts
  /** El dashboard imprimía `err.kind` crudo; el resto de la app usa domainErrorMessage. */
  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }
```

- [ ] **Step 5: Migrar `court-grid`**

En `src/app/features/dashboard/components/court-grid.component.ts`, reemplazar las líneas 22-26:

```html
@if (grid().courts.length === 0) {
  <p class="grid-empty">Todavía no hay canchas cargadas. Se agregan desde Configuración → Canchas.</p>
} @else if (grid().hours.length === 0) {
  <p class="grid-empty">No hay clases programadas para hoy.</p>
```

por:

```html
@if (grid().courts.length === 0) {
  <app-placeholder
    title="Todavía no hay canchas cargadas"
    body="Se agregan desde Configuración → Canchas."
  />
} @else if (grid().hours.length === 0) {
  <app-placeholder title="No hay clases programadas para hoy" />
```

Agregar `PlaceholderComponent` a los `imports`.

- [ ] **Step 6: Migrar `waitlist-card`**

En `src/app/features/dashboard/components/waitlist-card.component.ts`, reemplazar las líneas 22-23:

```html
<div class="a-empty">Sin lista de espera</div>
```

por:

```html
<app-placeholder title="Sin lista de espera" />
```

Agregar `PlaceholderComponent` a los `imports`.

- [ ] **Step 7: Borrar el CSS muerto**

- En `src/app/features/dashboard/pages/dashboard-page.component.css`, borrar la regla `.dash-status`.
- En `src/app/features/dashboard/components/court-grid.component.css`, borrar la regla `.grid-empty`.

- [ ] **Step 8: Actualizar los specs afectados**

```bash
grep -rn 'dash-status\|grid-empty\|Cargando panel\|err.kind' src/app/features/dashboard --include='*.spec.ts'
```

En cada assert encontrado, cambiar el selector por el texto visible. Ejemplo de la forma que tienen que tomar:

```ts
// Antes: expect(el.querySelector('.dash-status')).toBeTruthy();
// Después:
expect((el as HTMLElement).textContent).toContain('Cargando panel…');
```

Y para el error, agregar un assert nuevo de que ya no se filtra el `kind` crudo:

```ts
expect((el as HTMLElement).textContent).not.toContain('kind');
```

- [ ] **Step 9: Verificar**

```bash
npx ng test --include 'src/app/features/dashboard/**/*.spec.ts'
npx ng test --include src/app/shared/ui/en-construccion.component.spec.ts
npm run lint
```

Esperado: todo verde.

- [ ] **Step 10: Commit**

```bash
git add src/app/shared/ui/en-construccion.component.ts src/app/features/dashboard
git commit -m "$(cat <<'EOF'
refactor(dashboard): migrar estados a app-placeholder

Borra .dash-status y .grid-empty, y en-construccion pierde su CSS propio.

El error del panel deja de imprimir err.kind crudo y pasa por
domainErrorMessage, como el resto de la app.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Migrar alumnos

Primer consumidor de `app-notice` y el patrón de referencia para los cuatro `computed` de vacío que faltan.

**Files:**
- Modify: `src/app/features/alumnos/pages/alumnos-page.component.html:13-15, 17-18, 51-61`
- Modify: `src/app/features/alumnos/pages/alumnos-page.component.ts` (imports + `emptyTitle()`)
- Modify: `src/app/features/alumnos/alumno-form-modal.component.ts:25`
- Modify: `src/app/features/alumnos/alumno-planes-modal.component.ts:26, 30, 37`
- Test: `src/app/features/alumnos/pages/alumnos-page.component.spec.ts`, `src/app/features/alumnos/alumno-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `PlaceholderComponent` (Task 5), `NoticeComponent` (Task 6).
- Produces: el patrón `emptyTitle()` que replican las Tasks 12 y 14.

- [ ] **Step 1: Migrar el banner de error de la página**

En `alumnos-page.component.html`, reemplazar las líneas 13-15:

```html
  @if (errorText()) {
    <p class="notice hold" role="alert">{{ errorText() }}</p>
  }
```

por:

```html
  @if (errorText()) {
    <app-notice tone="bad">{{ errorText() }}</app-notice>
  }
```

El `role="alert"` **se va del call site**: ahora es dueño el primitivo, y declararlo dos veces hace que el lector de pantalla anuncie dos veces.

- [ ] **Step 2: Migrar el estado de carga**

Reemplazar las líneas 17-18:

```html
  @if (facade.loading()) {
    <p class="a-body">Cargando alumnos…</p>
```

por:

```html
  @if (facade.loading()) {
    <app-placeholder tone="loading" title="Cargando alumnos…" />
```

- [ ] **Step 3: Migrar el vacío, moviendo la rama de búsqueda a un `computed`**

Reemplazar las líneas 51-61:

```html
  } @else if (facade.data()) {
    <!-- El vacío sólo cuando la lista LLEGÓ vacía: si data() es null la carga falló y lo que
         corresponde es el banner de arriba, no "todavía no cargaste ningún alumno". -->
    <div class="a-empty">
      @if (query()) {
        Ningún alumno coincide con la búsqueda.
      } @else {
        Todavía no cargaste ningún alumno.
      }
    </div>
  }
```

por:

```html
  } @else if (facade.data()) {
    <!-- El vacío sólo cuando la lista LLEGÓ vacía: si data() es null la carga falló y lo que
         corresponde es el banner de arriba, no "todavía no cargaste ningún alumno". -->
    <app-placeholder [title]="emptyTitle()" />
  }
```

- [ ] **Step 4: Agregar el `computed` y los imports**

En `alumnos-page.component.ts`, agregar a los imports del `@Component`:

```ts
  imports: [/* …los que ya están…, */ PlaceholderComponent, NoticeComponent],
```

con:

```ts
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';
```

y agregar junto a `errorText()`:

```ts
  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query()
      ? 'Ningún alumno coincide con la búsqueda'
      : 'Todavía no cargaste ningún alumno',
  );
```

Verificar que `computed` esté en el import de `@angular/core`.

- [ ] **Step 5: Dejar anotado el chain repetido**

Alumnos es la primera página de lista que se migra, así que acá va el comentario que
pide el §7 del spec. Arriba del `@if (facade.loading())` en `alumnos-page.component.html`:

```html
  <!-- ponytail: este chain @if(loading) / @else if(datos) / @else if(vacío) está
       copiado en las 9 páginas de lista. Los primitivos no lo tocan. La salida es un
       contenedor <app-async [facade]="facade"> que proyecte el contenido por
       ng-template; se descartó ahora porque los vacíos no son uniformes —acá ramifica
       por query(), en reservas por la fecha, en grupo-detail distingue "no existe" de
       "está vacío"— y un tercio de los casos tendría que escaparse igual. -->
```

- [ ] **Step 6: Migrar los dos modales**

En `alumno-form-modal.component.ts:25`, reemplazar:

```html
@if (error()) { <p class="notice hold form-error" role="alert">{{ error() }}</p> }
```

por:

```html
@if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }
```

La clase `form-error` se va: nunca existió en ningún CSS.

En `alumno-planes-modal.component.ts`, hacer lo mismo en la línea 26 (con `errorText()` en vez de `error()`), y además:

- línea 30: `<p role="status">Cargando planes…</p>` → `<app-placeholder tone="loading" title="Cargando planes…" />`
- línea 37: `<p class="a-empty">Este alumno todavía no compró ningún plan.</p>` → `<app-placeholder title="Este alumno todavía no compró ningún plan" />`

Agregar los imports correspondientes a los dos modales.

- [ ] **Step 7: Actualizar los specs**

```bash
grep -rn 'a-empty\|notice\|form-error\|Cargando' src/app/features/alumnos --include='*.spec.ts'
```

Cada assert pasa a verificar texto visible. La forma:

```ts
// Antes: expect(el.querySelector('.a-empty')?.textContent).toContain('Todavía no cargaste');
// Después:
expect((el as HTMLElement).textContent).toContain('Todavía no cargaste ningún alumno');
```

Agregar además los dos asserts del vacío con y sin búsqueda, que hoy no existen como par:

```ts
it('el vacío distingue "sin datos" de "sin resultados"', async () => {
  // …montar la página con data() = [] y query() vacío…
  expect(el.textContent).toContain('Todavía no cargaste ningún alumno');

  // …setear query() a algo que no matchea…
  expect(el.textContent).toContain('Ningún alumno coincide con la búsqueda');
});
```

- [ ] **Step 8: Verificar**

```bash
npx ng test --include 'src/app/features/alumnos/**/*.spec.ts'
npm run lint
grep -rn 'a-empty\|form-error\|notice hold' src/app/features/alumnos
```

Esperado: tests verdes, lint limpio, y el `grep` **sin salida**.

- [ ] **Step 9: Commit**

```bash
git add src/app/features/alumnos
git commit -m "$(cat <<'EOF'
refactor(alumnos): migrar estados a app-placeholder y app-notice

Los errores pasan de .notice.hold (paleta warning) a tone="bad", y el
role="alert" se va del call site: ahora es dueño el primitivo.

Borra la clase form-error, que se aplicaba sin existir en ningún CSS.

La rama de búsqueda del vacío pasa a un computed, con un test que
verifica los dos textos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Migrar grupos

**Files:**
- Modify: `src/app/features/grupos/pages/grupos-list-page.component.html:2-4, 63-64, 70`
- Modify: `src/app/features/grupos/pages/grupos-list-page.component.ts` (imports + `emptyTitle()`)
- Modify: `src/app/features/grupos/pages/grupos-list-page.component.css:7, 13` (borrar `.grupos-status` y `.grupos-empty`)
- Modify: `src/app/features/grupos/pages/grupo-detail-page.component.html:2-4, 72-79, 92`
- Modify: `src/app/features/grupos/pages/grupo-detail-page.component.css:25` (borrar `.grupos-status`)
- Modify: `src/app/features/grupos/components/roster-table.component.ts:60`
- Modify: `src/app/features/grupos/components/sessions-table.component.ts:71`
- Test: los specs de `grupos-list-page` y `grupo-detail-page`

**Interfaces:**
- Consumes: `PlaceholderComponent`, `NoticeComponent`.
- Produces: nada nuevo.

- [ ] **Step 1: Migrar el chain de `grupos-list-page`**

Reemplazar las líneas 2-4:

```html
  <p class="grupos-status">Cargando grupos…</p>
} @else if (facade.error()) {
  <p class="grupos-status" role="alert">No se pudo cargar los grupos. {{ errorText() }}</p>
```

por:

```html
  <app-placeholder tone="loading" size="page" title="Cargando grupos…" />
} @else if (facade.error()) {
  <app-placeholder tone="error" size="page" title="No se pudo cargar los grupos" [body]="errorText()" />
```

- [ ] **Step 2: Unificar los dos vacíos de `grupos-list-page`**

Reemplazar la línea 63-64:

```html
} @empty {
  <tr><td colspan="6" class="grupos-empty">Sin grupos para esa búsqueda</td></tr>
}
```

por:

```html
} @empty {
  <tr><td colspan="6"><app-placeholder [title]="emptyTitle()" /></td></tr>
}
```

Y borrar la línea 70 (`<div class="a-empty">Todavía no hay grupos en el club</div>`) junto con su `@if`/`@else` envolvente, porque el `computed` ya cubre los dos casos. Verificar el bloque exacto antes de borrar:

```bash
sed -n '60,74p' src/app/features/grupos/pages/grupos-list-page.component.html
```

- [ ] **Step 3: Agregar el `computed` a `grupos-list-page.component.ts`**

```ts
  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Sin grupos para esa búsqueda' : 'Todavía no hay grupos en el club',
  );
```

Agregar `PlaceholderComponent` a los `imports` y `computed` al import de `@angular/core`. Si la página no tiene una signal `query()`, usar el nombre que sí tenga — verificar con:

```bash
grep -n 'query\|search\|filtro' src/app/features/grupos/pages/grupos-list-page.component.ts
```

- [ ] **Step 4: Migrar `grupo-detail-page`**

Líneas 2-4 (mismo chain que el Step 1, con el copy propio):

```html
  <app-placeholder tone="loading" size="page" title="Cargando grupo…" />
} @else if (facade.error()) {
  <app-placeholder tone="error" size="page" title="No se pudo cargar el grupo" [body]="errorText()" />
```

Nótese que el copy corrige el bug de hoy: la página de detalle decía "los grupos", en plural, copiado del listado.

Líneas 72-79 (el único vacío que ya tenía SVG inline):

```html
} @empty {
  <app-placeholder title="Nadie esperando" body="El grupo cubre su cupo." />
}
```

Línea 92:

```html
<p class="grupos-status">No encontramos ese grupo. <a routerLink="/grupos">Volver a la lista</a></p>
```

por:

```html
<app-placeholder tone="error" size="page" title="No encontramos ese grupo">
  <a class="btn btn-ghost" routerLink="/grupos">Volver a la lista</a>
</app-placeholder>
```

- [ ] **Step 5: Migrar las dos tablas**

- `roster-table.component.ts:60`: `<div class="a-empty">Nadie inscripto todavía</div>` → `<app-placeholder title="Nadie inscripto todavía" />`
- `sessions-table.component.ts:71`: `<div class="a-empty">Este grupo todavía no tiene sesiones</div>` → `<app-placeholder title="Este grupo todavía no tiene sesiones" />`

Agregar `PlaceholderComponent` a los `imports` de los dos.

- [ ] **Step 6: Borrar el CSS muerto**

- `grupos-list-page.component.css`: borrar `.grupos-status` (línea 7) y `.grupos-empty` (línea 13).
- `grupo-detail-page.component.css`: borrar `.grupos-status` (línea 25).

- [ ] **Step 7: Actualizar los specs**

```bash
grep -rn 'grupos-status\|grupos-empty\|a-empty\|Cargando' src/app/features/grupos --include='*.spec.ts'
```

Cada assert pasa a texto visible. Agregar uno que fije la corrección del copy:

```ts
it('el error del detalle habla del grupo, no de los grupos', async () => {
  // …montar con facade.error() seteado…
  expect(el.textContent).toContain('No se pudo cargar el grupo');
  expect(el.textContent).not.toContain('los grupos');
});
```

- [ ] **Step 8: Verificar y commitear**

```bash
npx ng test --include 'src/app/features/grupos/**/*.spec.ts'
npm run lint
grep -rn 'grupos-status\|grupos-empty\|a-empty' src/app/features/grupos
```

Esperado: tests verdes, lint limpio, `grep` sin salida.

```bash
git add src/app/features/grupos
git commit -m "$(cat <<'EOF'
refactor(grupos): migrar estados a app-placeholder

Borra .grupos-status (duplicada byte a byte en dos archivos) y
.grupos-empty. Los dos vacíos del listado se unifican en un computed.

Corrige el copy del detalle, que decía "no se pudo cargar los grupos"
copiado del listado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Migrar las páginas de configuración

Siete páginas con la misma estructura. Se hacen juntas porque comparten el patrón exacto y el diff es mecánico.

**Files:**
- Modify (página + ts + spec de cada una):
  - `src/app/features/configuracion/canchas/canchas-page.component.{html,ts,spec.ts}` — líneas 15, 19, 53-59
  - `src/app/features/configuracion/categorias/categorias-page.component.{html,ts,spec.ts}` — líneas 15, 19, 47-53
  - `src/app/features/configuracion/planes/planes-page.component.{html,ts,spec.ts}` — líneas 13, 17, 56-62
  - `src/app/features/configuracion/horarios/horarios-page.component.{html,ts,spec.ts}` — líneas 11, 15, 52-54
  - `src/app/features/configuracion/grupos-categoria/grupos-categoria-page.component.{html,ts,spec.ts}` — líneas 14, 18, 45-51
  - `src/app/features/configuracion/profesores/profesores-page.component.{html,ts,spec.ts}` — líneas 18, 22, 55
  - `src/app/features/configuracion/club/club-page.component.{html,ts,spec.ts}` — líneas 9, 75, 79-84

**Interfaces:**
- Consumes: `PlaceholderComponent`, `NoticeComponent`, el patrón `emptyTitle()` de la Task 10.
- Produces: nada nuevo.

- [ ] **Step 1: En cada una de las siete, migrar el banner de error**

```html
<p class="notice hold" role="alert">{{ errorText() }}</p>
```

pasa a:

```html
<app-notice tone="bad">{{ errorText() }}</app-notice>
```

Sin `role`: lo pone el primitivo.

- [ ] **Step 2: En cada una, migrar el texto de carga**

```html
<p class="a-body">Cargando X…</p>
```

pasa a:

```html
<app-placeholder tone="loading" title="Cargando X…" />
```

conservando el sustantivo de cada página: canchas, categorías, planes, horarios, grupos, profesores, y "los datos del club" en `club-page`.

- [ ] **Step 3: En las cuatro que ya ramifican por búsqueda, mover la rama a un `computed`**

Canchas, categorías, planes y grupos-categoría tienen el bloque `@if (query())`. En cada `.component.ts`, agregar (cambiando el sustantivo):

```ts
  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Ninguna cancha coincide con la búsqueda' : 'Todavía no cargaste ninguna cancha',
  );
```

y en el template:

```html
<app-placeholder [title]="emptyTitle()" />
```

- [ ] **Step 4: En horarios y profesores, agregar la rama de búsqueda que falta**

Estas dos páginas **no** ramifican, así que hoy un filtro sin resultados dice "todavía no cargaste ninguno", que es falso.

Verificar primero que la página tenga una signal de búsqueda:

```bash
grep -n 'query\|search' src/app/features/configuracion/horarios/horarios-page.component.ts
grep -n 'query\|search' src/app/features/configuracion/profesores/profesores-page.component.ts
```

**Si la tiene**, agregar el `computed` con la misma forma del Step 3:

```ts
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Ningún horario coincide con la búsqueda' : 'Todavía no cargaste ningún horario',
  );
```

y para profesores:

```ts
  protected readonly emptyTitle = computed(() =>
    this.query()
      ? 'Ningún profesor coincide con la búsqueda'
      : 'Todavía no hay profesores en este club',
  );
```

**Si no la tiene** (la página no tiene buscador), usar el título fijo y **no** inventar la signal:

```html
<app-placeholder title="Todavía no cargaste ningún horario" />
```

- [ ] **Step 5: Migrar `club-page`, que usa `.a-empty` como error**

`club-page.component.html:79-84` es el único `.a-empty` que en realidad es un error, y el único con botón Reintentar. Reemplazar:

```html
<div class="a-empty">
  No pudimos traer los datos del club.
  <button type="button" class="btn btn-ghost btn-sm" data-test="retry" (click)="retry()">Reintentar</button>
</div>
```

por:

```html
<app-placeholder tone="error" title="No pudimos traer los datos del club">
  <button type="button" class="btn btn-ghost btn-sm" data-test="retry" (click)="retry()">Reintentar</button>
</app-placeholder>
```

El `data-test="retry"` se conserva: hay un spec que lo busca.

- [ ] **Step 6: Agregar los imports en las siete**

En cada `.component.ts`:

```ts
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';
```

y los dos componentes en el array `imports` del decorador. Donde se agregó un `computed`, verificar que esté importado de `@angular/core`.

- [ ] **Step 7: Actualizar los specs de las siete**

```bash
grep -rn 'a-empty\|notice\|Cargando' src/app/features/configuracion --include='*-page.component.spec.ts'
```

Cada assert pasa a texto visible. Para horarios y profesores, si se agregó la rama de búsqueda, agregar el test del par:

```ts
it('el vacío distingue "sin datos" de "sin resultados"', async () => {
  // …montar con lista vacía y sin búsqueda…
  expect(el.textContent).toContain('Todavía no cargaste ningún horario');
  // …setear la búsqueda…
  expect(el.textContent).toContain('Ningún horario coincide con la búsqueda');
});
```

- [ ] **Step 8: Verificar y commitear**

```bash
npx ng test --include 'src/app/features/configuracion/**/*-page.component.spec.ts'
npm run lint
grep -rn 'a-empty\|notice hold\|a-body' src/app/features/configuracion --include='*-page.component.html'
```

Esperado: tests verdes, lint limpio, `grep` sin salida.

```bash
git add src/app/features/configuracion
git commit -m "$(cat <<'EOF'
refactor(configuracion): migrar las siete páginas a los primitivos

Horarios y profesores ganan la rama de búsqueda que les faltaba: hasta
ahora un filtro sin resultados decía "todavía no cargaste ninguno".

club-page deja de usar .a-empty para mostrar un error; ahora es un
placeholder tone="error" con el Reintentar proyectado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Migrar los modales de configuración

Ocho modales con el mismo error inline, y tres con vacíos propios.

**Files:**
- Modify: `src/app/features/configuracion/canchas/cancha-form-modal.component.ts:22`
- Modify: `src/app/features/configuracion/categorias/categoria-form-modal.component.ts:19`
- Modify: `src/app/features/configuracion/planes/plan-form-modal.component.ts:23`
- Modify: `src/app/features/configuracion/planes/plan-categorias-modal.component.ts:23, 37-38`
- Modify: `src/app/features/configuracion/grupos-categoria/grupo-categoria-form-modal.component.ts:24`
- Modify: `src/app/features/configuracion/grupos-categoria/grupo-items-modal.component.ts:22, 36-37`
- Modify: `src/app/features/configuracion/horarios/horario-form-modal.component.ts:30`
- Modify: `src/app/features/configuracion/horarios/generar-clases-modal.component.ts:43`
- Modify: `src/app/features/configuracion/profesores/profesor-form-modal.component.ts:23`
- Modify: `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.ts:34`
- Test: los `*-modal.component.spec.ts` de esas rutas

**Interfaces:**
- Consumes: `PlaceholderComponent`, `NoticeComponent`.
- Produces: nada nuevo.

- [ ] **Step 1: En los diez modales, migrar el error**

```html
<p class="notice hold form-error" role="alert">{{ error() }}</p>
```

pasa a:

```html
<app-notice tone="bad">{{ error() }}</app-notice>
```

`generar-clases-modal.component.ts:43` es el único sin `form-error`, pero el reemplazo es el mismo. En los que usan `errorText()` en vez de `error()`, conservar el nombre que ya tienen.

- [ ] **Step 2: Migrar los dos vacíos**

- `plan-categorias-modal.component.ts:37-38`: `<p class="a-empty">Todavía no cargaste ninguna categoría.</p>` → `<app-placeholder title="Todavía no cargaste ninguna categoría" />`
- `grupo-items-modal.component.ts:36-37`: mismo texto, mismo reemplazo.

- [ ] **Step 3: Agregar los imports**

En cada modal, `NoticeComponent` (y `PlaceholderComponent` en los dos del Step 2), tanto en el import como en el array `imports` del decorador.

- [ ] **Step 4: Actualizar los specs**

```bash
grep -rn 'form-error\|notice\|a-empty' src/app/features/configuracion --include='*-modal.component.spec.ts'
```

Los asserts pasan a texto visible o al selector del primitivo cuando lo que se verifica es la presencia del aviso:

```ts
// Antes: expect(el.querySelector('.form-error')).toBeTruthy();   ← nunca verificó nada:
//        .form-error no existía en ningún CSS.
// Después:
expect((el as HTMLElement).textContent).toContain('El nombre es obligatorio');
```

- [ ] **Step 5: Verificar y commitear**

```bash
npx ng test --include 'src/app/features/configuracion/**/*-modal.component.spec.ts'
npm run lint
grep -rn 'form-error\|notice hold\|a-empty' src/app/features/configuracion
```

Esperado: tests verdes, lint limpio, `grep` sin salida.

```bash
git add src/app/features/configuracion
git commit -m "$(cat <<'EOF'
refactor(configuracion): migrar los modales a app-notice

Borra la clase form-error de los diez modales que la aplicaban: no
existía en ningún CSS, así que los asserts que la buscaban pasaban en
verde sin verificar nada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Migrar reservas

**Files:**
- Modify: `src/app/features/reservas/pages/reservas-page.component.html:18, 22, 65`
- Modify: `src/app/features/reservas/pages/reservas-page.component.ts` (imports)
- Modify: `src/app/features/reservas/components/sesion-modal.component.ts:27, 70-71, 141-142, 152-153`
- Modify: `src/app/features/reservas/components/cancelar-clase-modal.component.ts` (el error, si lo tiene)
- Modify: `src/app/features/reservas/components/asistencia-seccion.component.css:13` (borrar `.hint`, que reimplementa `.field .hint` de `components.css:103`)
- Test: los specs de reservas

**Interfaces:**
- Consumes: `PlaceholderComponent`, `NoticeComponent`.
- Produces: nada nuevo.

- [ ] **Step 1: Migrar la página**

- línea 18: `<p class="notice hold" role="alert">{{ errorText() }}</p>` → `<app-notice tone="bad">{{ errorText() }}</app-notice>`
- línea 22: `<p class="a-body">Cargando clases…</p>` → `<app-placeholder tone="loading" title="Cargando clases…" />`
- línea 65: `<div class="a-empty">No hay clases generadas para esta fecha.</div>` → `<app-placeholder title="No hay clases generadas para esta fecha" />`

El vacío de reservas depende de la fecha elegida, no de un buscador, así que **no** lleva `computed`: el texto es siempre el mismo.

- [ ] **Step 2: Migrar `sesion-modal`**

- línea 27: el error → `<app-notice tone="bad">{{ error() }}</app-notice>`
- líneas 70-71: `<p class="a-empty">Todavía no se anotó nadie.</p>` → `<app-placeholder title="Todavía no se anotó nadie" />`
- líneas 141-142: `<p class="a-empty">Ninguna reserva pendiente.</p>` → `<app-placeholder title="Ninguna reserva pendiente" />`
- líneas 152-153: `<p class="a-empty">Sin lista de espera.</p>` → `<app-placeholder title="Sin lista de espera" />`

- [ ] **Step 3: Migrar `cancelar-clase-modal`**

```bash
grep -n 'notice\|form-error\|a-empty' src/app/features/reservas/components/cancelar-clase-modal.component.ts
```

Aplicar el mismo reemplazo a lo que aparezca.

- [ ] **Step 4: Borrar el `.hint` duplicado**

En `asistencia-seccion.component.css`, borrar la regla `.hint` de la línea 13: reimplementa `.field .hint`, que ya está en `components.css:103`. Verificar en el navegador que el hint de esa sección se siga viendo igual.

- [ ] **Step 5: Agregar los imports y actualizar los specs**

```bash
grep -rn 'a-empty\|notice\|Cargando' src/app/features/reservas --include='*.spec.ts'
```

Asserts a texto visible, como en las tareas anteriores.

- [ ] **Step 6: Verificar y commitear**

```bash
npx ng test --include 'src/app/features/reservas/**/*.spec.ts'
npm run lint
grep -rn 'a-empty\|notice hold\|a-body\|form-error' src/app/features/reservas
```

Esperado: tests verdes, lint limpio, `grep` sin salida.

```bash
git add src/app/features/reservas
git commit -m "$(cat <<'EOF'
refactor(reservas): migrar estados a los primitivos

Los tres vacíos del modal de sesión, el chain de la página y el error
inline. Borra el .hint de asistencia-seccion, que reimplementaba el
.field .hint de components.css.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Migrar auth y onboarding

Las cinco pantallas de auth definen `.error` cuatro veces, tres de ellas idénticas, y `.field-err` dos veces — que es lo que ya resuelve `app-field-error` (Task 7).

**Files:**
- Modify: `src/app/features/auth/pages/login-page.component.ts:39, 62`
- Modify: `src/app/features/auth/pages/reset-password-page.component.ts:72, 91`
- Modify: `src/app/features/auth/pages/change-password-page.component.ts:51, 65`
- Modify: `src/app/features/auth/pages/verification-sent-page.component.ts:29, 38, 47, 67, 68, 69`
- Modify: `src/app/features/auth/pages/verify-email-page.component.ts:20, 33, 40, 45, 64`
- Modify: `src/app/features/onboarding/pages/onboarding-wizard.component.html:56-58`
- Modify: `src/app/features/onboarding/pages/onboarding-wizard.component.css:49` (borrar `.foot-error`)
- Test: los specs de auth y onboarding

**Interfaces:**
- Consumes: `NoticeComponent` (Task 6), `PlaceholderComponent` (Task 5), `FieldErrorComponent` (Task 7).
- Produces: nada nuevo.

- [ ] **Step 1: Migrar los errores de formulario de las cinco pantallas de auth**

En cada una:

```html
<p class="error" role="alert">{{ msg }}</p>
```

pasa a:

```html
<app-notice tone="bad">{{ msg }}</app-notice>
```

En `verification-sent-page.component.ts:47` la expresión es `{{ domainErrorMessage(err) }}`; se conserva tal cual dentro del `app-notice`.

En `verify-email-page.component.ts:33` el `<p role="alert">{{ errorMessage() }}</p>` **no tiene clase**: mismo reemplazo.

- [ ] **Step 2: Migrar los errores de campo a `app-field-error`**

`verify-email-page.component.ts:40` y `verification-sent-page.component.ts:29` y `:38`:

```html
<p class="field-err" role="alert">Ingresá un email válido.</p>
```

pasa a:

```html
<app-field-error [show]="true" message="Ingresá un email válido." />
```

Si el `<p>` estaba dentro de un `@if (condicion) { … }`, mover la condición al input y borrar el `@if`:

```html
<app-field-error [show]="condicion" message="Ingresá un email válido." />
```

- [ ] **Step 3: Migrar los estados de carga de `verify-email-page`**

- línea 20: `<p role="status">Verificando tu email…</p>` → `<app-placeholder tone="loading" title="Verificando tu email…" />`
- línea 45: `<p role="status">Reenviando el link…</p>` → `<app-placeholder tone="loading" title="Reenviando el link…" />`

- [ ] **Step 4: Migrar el `.ok` de `verification-sent-page`**

`verification-sent-page.component.ts:67` define `.ok{color:var(--color-accent-strong);font-weight:600}`. El `<p class="ok">` que la usa pasa a:

```html
<app-notice tone="ok">{{ …el mismo contenido… }}</app-notice>
```

Localizarlo con:

```bash
grep -n 'class="ok"' src/app/features/auth/pages/verification-sent-page.component.ts
```

- [ ] **Step 5: Migrar onboarding**

`onboarding-wizard.component.html:56-58`:

```html
@if (facade.error(); as err) {
  <p class="foot-error" role="alert">{{ domainErrorMessage(err) }}</p>
}
```

pasa a:

```html
@if (facade.error(); as err) {
  <app-notice tone="bad">{{ domainErrorMessage(err) }}</app-notice>
}
```

- [ ] **Step 6: Borrar el CSS muerto**

- Las cuatro definiciones de `.error` en `login-page`, `change-password-page`, `reset-password-page` y `verification-sent-page`.
- Las dos de `.field-err` en `verify-email-page:64` y `verification-sent-page:69`.
- `.ok` en `verification-sent-page:67`.
- `.foot-error` en `onboarding-wizard.component.css:49`.

- [ ] **Step 7: Agregar los imports y actualizar los specs**

```bash
grep -rn 'class="error"\|field-err\|foot-error\|role="status"\|Verificando' src/app/features/auth src/app/features/onboarding --include='*.spec.ts'
```

Asserts a texto visible.

- [ ] **Step 8: Verificar y commitear**

```bash
npx ng test --include 'src/app/features/auth/**/*.spec.ts'
npx ng test --include 'src/app/features/onboarding/**/*.spec.ts'
npm run lint
grep -rn '\.error{\|\.field-err{\|foot-error' src/app/features/auth src/app/features/onboarding
```

Esperado: tests verdes, lint limpio, `grep` sin salida.

```bash
git add src/app/features/auth src/app/features/onboarding
git commit -m "$(cat <<'EOF'
refactor(auth): migrar estados a los primitivos compartidos

Borra las cuatro definiciones locales de .error (tres idénticas), las dos
de .field-err y el .foot-error del wizard. Los errores de campo pasan a
app-field-error, que auth no podía usar hasta que se promovió a shared.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Barrido final

El gate del §6.2 del spec. La migración no termina cuando "se ve bien": termina cuando estos comandos dan los números de la tabla.

**Files:**
- Modify: `styles/components.css` (borrar `.a-empty` y `.a-empty svg`, líneas 171-172)
- Modify: los que el barrido encuentre

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: nada.

- [ ] **Step 1: Correr el gate de clases muertas**

```bash
for c in a-empty form-error grupos-status dash-status grupos-empty grid-empty foot-error; do
  printf "%-16s %s\n" "$c" "$(grep -rno -- "$c" src/app styles 2>/dev/null | wc -l | tr -d ' ')"
done
grep -rn '\.field-err{' src/app styles | wc -l
grep -rn '\.error{' src/app | wc -l
```

Esperado: **todos 0**, salvo `a-empty`, que todavía tiene sus 2 definiciones en `components.css` hasta el Step 2.

Si alguno no da 0, el `grep -rn` sin `-o` dice exactamente dónde quedó. Migrarlo con el patrón de la tarea que le corresponde antes de seguir.

- [ ] **Step 2: Borrar `.a-empty` de `components.css`**

Ya no tiene consumidores. Borrar las dos reglas de `styles/components.css:171-172`:

```css
.a-empty{padding:var(--space-lg);text-align:center;color:var(--color-fg-subtle);font-size:var(--text-2xs)}
.a-empty svg{width:26px;height:26px;margin-bottom:var(--space-sm);opacity:.6}
```

Volver a correr el gate del Step 1: `a-empty` ahora tiene que dar **0**.

- [ ] **Step 3: Verificar los dos que NO pueden dar cero**

```bash
grep -rno 'notice hold' src/app | wc -l
grep -rn 'notice hold' src/app
```

Esperado: **mayor que 0**. Lo que queda tienen que ser advertencias reales (cupos, esperas, `.sess.wait`), no errores. Revisar la lista una por una. **Si da 0, se borró una advertencia legítima** — recuperarla del historial.

- [ ] **Step 4: Verificar que ningún call site declara el rol que ya pone el primitivo**

```bash
grep -rn 'app-notice[^>]*role=\|app-placeholder[^>]*role=' src/app
```

Esperado: **sin salida**. Si un call site declara `role="alert"` sobre un primitivo que ya lo pone, el lector de pantalla anuncia dos veces.

- [ ] **Step 5: Verificar que no bajó la cobertura**

```bash
grep -rn -e 'a-empty' -e 'notice' -e 'grupos-status' -e 'dash-status' -e 'field-err' -e 'Cargando' \
  -e 'app-placeholder' -e 'app-notice' -e 'app-field-error' \
  src/app --include='*.spec.ts' | wc -l
```

Esperado: **45 o más**. El baseline antes de esta migración era exactamente 45. Si bajó, se perdió cobertura: identificar qué spec quedó con menos asserts y decir por qué.

- [ ] **Step 6: Suite completa y lint**

```bash
npm test && npm run lint && npm run build
```

Esperado: los tres verdes. Pegar la salida — sin ella el barrido no cuenta como hecho.

- [ ] **Step 7: Revisión visual en las dos superficies que renderizan distinto**

```bash
npm start
```

`shell.component.css` redefine la escala `--text-*` en su `:host`, así que el mismo primitivo se ve más denso adentro del shell que afuera. Verificar `size='page'` en las dos:

- **Dentro del shell:** `/asdf` (404) y el dashboard con error forzado.
- **Fuera del shell:** `/login` con credenciales malas, y `/onboarding`.

Y `size='inline'`: una página de lista de configuración en sus tres estados (cargando, vacío, error) y un modal con error de validación.

- [ ] **Step 8: Commit**

```bash
git add -A src/app styles
git commit -m "$(cat <<'EOF'
chore: barrido final de la migración de estados

Borra .a-empty de components.css, ya sin consumidores. Gate del §6.2 del
spec en cero para las nueve clases muertas, .notice.hold conservada sólo
para advertencias reales, y ningún call site duplicando el rol ARIA que
pone el primitivo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```
