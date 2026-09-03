# Marca Pipofy y primitivos de estado — diseño

Fecha: 2026-09-03

Dos cosas que se hacen juntas porque comparten los mismos archivos: adoptar el
brandboard de Pipofy (paleta, tipografía, logo) y darle a la app un vocabulario
único para los estados de vacío, error y carga, ilustrado con esa marca.

Hoy la app usa una paleta azul genérica con acento verde, fuentes Fira, un logo
inline que dice "SetPoint · Club Ops", y renderiza los estados de vacío/error/carga
con seis patrones distintos repartidos en ~70 lugares.

## 1. Marca

### 1.1 Assets

`assets/` es la carpeta fuente del brandboard. A `public/` — que Angular copia a la
raíz del sitio (`angular.json:19-22`) — van **sólo las piezas con consumidor real
hoy**, según la regla de admisión del design system (`CLAUDE.md`, sección Estilos):

| Origen | Destino | Consumidor |
|---|---|---|
| `assets/logos/03-logo-horizontal.svg` | `public/brand/logo-horizontal.svg` | `BrandmarkComponent` |
| `assets/07d-favicon.svg` | `public/brand/favicon.svg` | `src/index.html` |

Las demás piezas (isotipo, vertical, cabecera-web, backoffice, app-icon) quedan en
`assets/` hasta que algo las use.

A los dos archivos que se copian se les elimina el bloque `<metadata>` con la firma
C2PA, que es base64 y no aporta nada al render: el horizontal pasa de 16KB a 5.4KB
y el favicon de 12KB a ~1KB. La geometría no se toca.

`public/favicon.ico` se elimina: es el favicon por defecto del scaffold de Angular.

### 1.2 Paleta

Todo el color vive en `styles/tokens.css`. El brandboard define cinco colores y un
degradado; el resto de los tokens son derivados con contraste verificado, como ya
hace el archivo hoy.

Mapeo de roles, siguiendo lo que el propio brandboard asigna a cada color:

| Token | Antes | Ahora | Por qué |
|---|---|---|---|
| `--color-primary` | `#2563EB` | `#2267AC` | El brandboard asigna Web Blue a "enlaces y acentos de interfaz" |
| `--color-primary-hover` | `#1D4ED8` | `#1B5595` | Tono medio del degradado del icono |
| `--color-primary-strong` | `#1E3A8A` | `#082658` | Primary de marca: superficies oscuras y máximo contraste |
| `--color-primary-soft` | `#EFF4FE` | `#EAF2FA` | Tinte de Web Blue |
| `--color-on-primary-soft` | `#1D4ED8` | `#1B5595` | |
| `--color-secondary` | `#3B82F6` | `#2E78C0` | Extremo claro del degradado |
| `--color-foreground` | `#0F172A` | `#082658` | El brandboard asigna Primary a "textos" |
| `--color-background` | `#F8FAFC` | `#F7F9FC` | Off-white con tinte navy |
| `--color-muted` | `#F1F5FD` | `#EEF3F9` | |
| `--color-border` | `#E4ECFC` | `#DDE5EE` | Neutral aclarado |
| `--color-border-strong` | `#E2E8F0` | `#ABB4BD` | Neutral del brandboard, tal cual |
| `--color-fg-muted` | `#475569` | `#4A5B73` | Gris con tinte navy |
| `--color-fg-subtle` | `#586675` | `#5A6B82` | |
| `--color-ring` | `#2563EB` | `#2267AC` | |

Contrastes verificados (WCAG AA pide 4.5:1 para texto normal):

```
 5.83  primary #2267AC sobre blanco        ✓   5.83  blanco sobre primary
 7.55  primary-hover #1B5595 sobre blanco  ✓  14.70  blanco sobre primary-strong
14.70  primary-strong #082658 sobre blanco ✓  13.94  fg #082658 sobre background
 4.60  secondary #2E78C0 sobre blanco      ✓   6.68  on-primary-soft sobre soft
 6.92  fg-muted sobre blanco               ✓   6.20  fg-muted sobre muted
 5.44  fg-subtle sobre blanco              ✓   4.88  fg-subtle sobre muted
```

Dos colores del brandboard **no llegan a AA sobre fondo claro** y por eso tienen uso
restringido, que es además lo que el propio brandboard indica:

- **Accent `#6DB5E5`** — 2.24:1 sobre blanco, 6.57:1 sobre navy. Sólo para realces
  sobre superficies oscuras. Nunca texto ni fondo claro.
- **Neutral `#ABB4BD`** — 2.10:1 sobre blanco. Sólo bordes y separadores. El
  brandboard lo menciona para "texto deshabilitado", pero a ese ratio sería
  ilegible; el texto deshabilitado sigue usando `--color-fg-subtle` con opacidad.

`--color-destructive` y la familia `--color-warning-*` **no cambian**: son colores
semánticos, no de marca, igual que hoy.

### 1.3 El verde deja de existir

`--color-accent` era verde `#059669` y marca estados "abierto / confirmado / ok" en
17 lugares. El brandboard no tiene verde, y la decisión fue ir todo azul. La familia
`--color-accent-*` **conserva sus nombres** y pasa a apuntar a la familia Web Blue:

```css
/* ponytail: el estado "ok" y el color primario son ahora el mismo azul — un badge
   "confirmado" no se distingue de un botón primario. Si esa distinción hace falta,
   entra una familia --color-success-* con un verde armonizado al navy y estos
   alias apuntan ahí; los 17 consumidores no cambian. */
--color-accent:#2E78C0; --color-accent-mark:#2E78C0;
--color-accent-strong:#2267AC; --color-accent-hover:#1B5595;
--color-accent-soft:#EAF2FA; --color-on-accent-soft:#1B5595;
--color-accent-soft-border:#C5DCF0;
```

Se conservan los nombres en vez de reescribir los 17 consumidores porque el alias
deja el punto de reversión en un solo lugar.

### 1.4 Tipografía

El brandboard nombra "Pipofy Sans", que no existe como fuente publicada; el `LEEME`
resuelve en **Poppins** (SIL OFL, Google Fonts).

- `src/index.html`: el `<link>` de Google Fonts pide `Poppins:wght@300;400;500;600;700`
  en lugar de `Fira Code` + `Fira Sans`.
- `--font-heading` y `--font-body` → Poppins con fallback de sistema.
- `--font-mono` deja de ser `var(--font-heading)`. Poppins no es monoespaciada y el
  token se usa en `.mono` para `font-variant-numeric: tabular-nums` en ids y números,
  donde una proporcional rompe la alineación. Pasa a stack de sistema
  (`ui-monospace, SF Mono, Menlo, Consolas, monospace`), que **no descarga nada**.

Neto: se baja una familia en vez de dos.

### 1.5 Brandmark

`shared/ui/brandmark.component.ts` reemplaza el SVG inline genérico y los dos
`<span>` de texto por una sola imagen:

```html
<a class="brandmark" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
  <img class="bm-img" src="brand/logo-horizontal.svg" alt="Pipofy" />
</a>
```

El texto ya está convertido a trazados dentro del SVG; duplicarlo en HTML lo
desalinearía. El `alt` mantiene el nombre accesible y el `aria-label` del enlace
sigue describiendo el destino. En `tokens.css` entra
`.brandmark .bm-img{height:36px;width:auto;display:block}`.

Las reglas `.bm-logo` / `.bm-name` / `.bm-sub` **se conservan**: las siguen usando
`index-v2.html` y `onboarding.html`, que son maquetas de referencia fuera del build
(`CLAUDE.md`, sección Estilos). Editar tres HTML estáticos cuesta más que dejar
cuatro reglas con consumidor real.

### 1.6 Favicon

`src/index.html`: `<link rel="icon" type="image/svg+xml" href="brand/favicon.svg">`.

## 2. Primitivos de estado

### 2.1 El problema

Auditoría de los ~70 lugares que hoy renderizan estos estados:

| Estado | Lugares | Patrones | Problemas concretos |
|---|---|---|---|
| Vacío | 21 | 3 clases | `@if (query())` copiado literal 5 veces; profesores, horarios y reservas se olvidaron esa rama; `grupos-list` y `court-grid` inventaron clase propia |
| Error | 30 | 6 patrones | `.form-error` se aplica en 11 modales y **no existe en ningún CSS**; `.error` redefinida 4 veces en auth; dashboard imprime `err.kind` crudo en vez de `domainErrorMessage`; los errores se pintan con la paleta *warning* |
| Carga | 20 | 4 patrones | 12 de 15 textos sin `role="status"`: no se anuncian a lectores de pantalla; `.grupos-status` duplicada byte a byte y clonada como `.dash-status` |
| 404 | 0 | — | No hay ruta wildcard: una URL desconocida renderiza pantalla en blanco |

Las 70 apariciones son en realidad **dos formas visuales**: un bloque centrado y una
barra inline. Los primitivos siguen esa división, no la división por estado.

### 2.2 `app-placeholder` — el bloque centrado

```ts
tone  = input<'empty' | 'error' | 'loading' | 'wip'>('empty');
size  = input<'inline' | 'page'>('inline');
title = input.required<string>();
body  = input('');
// la acción va por <ng-content>
```

`tone` decide tres cosas a la vez, y por eso no hay input de ilustración ni de rol:
elige el spot, y fija el rol ARIA — `alert` en error, `status` en carga, ninguno en
vacío y wip. Ese mapeo es lo que arregla el bug de accesibilidad de los 12 textos de
carga mudos.

Los 5 usos con `size='page'` son los 3 errores de pantalla completa, el 404 y
`en-construccion`.

`size='inline'` reproduce la métrica actual de `.a-empty` (`padding: var(--space-lg)`,
`--text-2xs`, spot de 26px) y es el default, porque 36 de los 41 usos son inline
dentro de una tabla o un modal: los 21 vacíos y los 15 textos de carga. `size='page'` es el bloque de pantalla completa:
`max-width: 420px`, centrado con `margin: var(--space-3xl) auto`, spot de 72px.

Cubre: los 21 vacíos, los 3 errores de pantalla completa, los 15 textos de carga, el
404 y `en-construccion`.

### 2.3 `app-notice` — la barra inline

```ts
tone = input<'bad' | 'hold' | 'ok'>('bad');   // contenido por <ng-content>
```

Envuelve las reglas `.notice` que ya existen en `styles/components.css:303-305` y
suma la que falta:

```css
.notice.bad{background:var(--color-destructive-soft);
            border:1px solid var(--color-destructive-soft-border);
            color:var(--color-on-destructive-soft)}
```

`--color-destructive-soft` (`tokens.css:69`) y `--color-on-destructive-soft` ya
existen. `--color-destructive-soft-border: #F7CECE` es el único token nuevo de toda
esta sección, y sigue la relación que ya tiene `--color-warning-soft-border`
(`#F4DCA0`) con su fondo. Un borde no necesita ratio de contraste.

Hoy los 30 errores usan `.notice.hold`, que es la paleta **warning**: un error de red
se ve amarillo, igual que una advertencia de cupo. Con `tone='bad'` pasan a rojo, y
`.notice.hold` queda para lo que sí es una advertencia (`.sess.wait`, avisos de cupo).
Es un cambio de color visible en 30 pantallas, y es intencional.

Rol ARIA: `alert` en `bad` y `hold`, `status` en `ok`.

### 2.4 `app-field-error` — se muda, no se crea

`features/onboarding/components/field-error.component.ts` ya existe y tiene 14 usos.
Vive dentro de una feature, así que los boundaries de `eslint-plugin-boundaries`
prohíben importarlo desde otra — y por eso auth se dibujó su propio `.field-err` dos
veces. Se mueve a `shared/ui/` sin cambios de código; los 14 usos sólo actualizan el
import, y auth gana un consumidor legítimo.

### 2.5 Las ilustraciones

Cuatro spots dibujados con la geometría de `assets/logos/01-isotipo.svg`, que es
vectorial y separable: la pala (cabeza, puente, mango, perforaciones) y la pelota son
grupos independientes.

| tone | Spot |
|---|---|
| `empty` | La pala apoyada, sin pelota |
| `error` | La pelota picando fuera de la línea |
| `loading` | La pelota rodando — rotación lineal de 900ms |
| `wip` | La pala con cinta de obra; reemplaza el emoji 🚧 de `en-construccion` |

Van **inline en un `@switch` dentro de `app-placeholder`**, no como componente
aparte: no tendrían otro consumidor, y así no cuestan un request. Trazo en
`currentColor` y rellenos en `--color-primary-soft`, de modo que heredan la paleta
sin hardcodear ningún hex.

La animación de `loading` no necesita guarda propia: el bloque
`@media (prefers-reduced-motion: reduce)` de `tokens.css:108` ya anula toda animación
del documento.

## 3. Migración

### 3.1 Vacíos (21 → `app-placeholder`)

Los 5 que ramifican por `query()` calculan `title` y `body` en un `computed` de la
página en vez de repetir el `@if/@else` en el template. Las 3 que se olvidaron esa
rama (profesores, horarios, reservas) la ganan de paso: hoy un filtro sin resultados
dice "todavía no cargaste ninguno", que es falso.

`grupos-list` (`.grupos-empty` dentro de un `<td colspan="6">`) y `court-grid`
(`.grid-empty`, dos casos) pierden sus clases propias.

`grupo-detail:72-79` es el único vacío que hoy tiene SVG inline; pasa al spot del
primitivo.

### 3.2 Errores (30)

- 27 inline → `app-notice tone="bad"`: los 9 banners de página, los 12 de modal, los
  4 de auth y `generar-clases-modal` (que hoy es el único sin `.form-error`).
- 3 de pantalla completa → `app-placeholder tone="error" size="page"`:
  `grupos-list`, `grupo-detail`, `dashboard`.
- `dashboard-page.component.html:3-4` deja de imprimir `{{ err.kind }}` y pasa por
  `domainErrorMessage`, como el resto de la app.
- `grupo-detail` conserva su "no encontramos ese grupo" con el link de vuelta, ahora
  como `app-placeholder` con la acción proyectada.
- `club-page` conserva su botón Reintentar, también proyectado.

### 3.3 Carga (15 → `app-placeholder tone="loading"`)

Los 5 label-swap de botón (`'Entrando…'`, `'Guardando…'`, `[class.loading]`) **no se
tocan**: son estado in-place de un control, no un placeholder.

### 3.4 CSS que se borra

`.grupos-status` (×2, byte a byte iguales), `.dash-status`, `.grupos-empty`,
`.grid-empty`, `.error` (×4 en auth, 3 idénticas), `.field-err` (×2), `.foot-error`
del onboarding, y los `.ec*` de `en-construccion` — que pasa a consumir el primitivo.

La clase muerta `.form-error` se borra de los 11 templates que la aplican.

`.a-empty` y `.a-empty svg` se borran de `components.css` una vez migrados los 18
consumidores.

### 3.5 Especificaciones que hay que actualizar

**45 asserts en 23 archivos `.spec.ts`** apuntan a `.a-empty`, `.notice`,
`.grupos-status`, `.dash-status`, `.field-err` o al texto "Cargando…". Todos se
actualizan a los selectores nuevos. Es aproximadamente la mitad del trabajo de la
migración y no hay forma de evitarlo: son asserts sobre el markup que cambia.

## 4. Ruta 404

`app.routes.ts` no tiene wildcard: una URL desconocida no matchea nada y renderiza
pantalla en blanco, sin shell ni mensaje.

Entra `{ path: '**', component: NotFoundPageComponent }` como **último hijo del
shell**. Así la página cae dentro del layout y el usuario tiene la sidebar para ir a
otro lado; y como el shell está detrás de `authGuard`, una URL desconocida sin sesión
redirige al login antes de llegar.

`NotFoundPageComponent` es un `app-placeholder size="page" tone="error"` con un link
al dashboard proyectado. Diez líneas.

## 5. Testing

Qué se corre. Las **reglas** de qué tiene que assertar cada test están en §6.3, y el
gate que decide si la migración terminó, en §6.2.

- **`placeholder.component.spec.ts`** (nuevo, y escrito antes que el componente):
  los cuatro casos del mapeo `tone → rol ARIA`. `provideZonelessChangeDetection()` en
  los providers, como todo `TestBed` del repo. No lleva dobles: el primitivo no
  inyecta nada.
- **`app-notice` y `app-field-error` no llevan spec propio**: son markup sin ramas, y
  los specs de página que ya los usan los ejercitan.
- Los 45 asserts existentes, actualizados junto a su página (§6.4 paso 6).
- `npm run lint`: es lo único que verifica que nadie siga importando `field-error`
  desde `features/onboarding` y que los primitivos respeten los boundaries de capa.
- `npm test` completo.
- Pasada visual con `npm start`, en las superficies que renderizan distinto: shell,
  login y wizard de onboarding (las tres del brandmark), una página de lista en sus
  tres estados, y `/asdf` para el 404.

## 6. Guardrails contra fallos y deuda

Las secciones anteriores describen qué se construye. Esta define qué tiene que
**fallar solo** si se construye mal. Sin esto, una migración de 70 sitios degrada en
silencio: quedan clases zombi, asserts que ya no assertan nada, y un primitivo al que
se le agrega un caso sin ilustración.

### 6.1 El tipo obliga, no el comentario

`tone` mapea a dos cosas: rol ARIA e ilustración. Las dos van en un `Record` completo,
**no** en un `@switch` con rama por defecto ni en una cadena de `if`:

```ts
type PlaceholderTone = 'empty' | 'error' | 'loading' | 'wip';

const ROLE: Record<PlaceholderTone, 'alert' | 'status' | null> = {
  empty: null, error: 'alert', loading: 'status', wip: null,
};
```

Agregar un `tone` rompe el build hasta que tenga rol e ilustración, exactamente como
`domainErrorMessage` (`core/domain/errors.ts:87`) rompe el build al agregar un `kind`
sin copy. Es el idioma que el repo ya usa para este problema; el primitivo no
inventa uno nuevo.

El `@switch` del template que elige el spot sí puede existir, pero **sin `@default`**:
la exhaustividad la garantiza el `Record`, no el template.

### 6.2 El gate de migración es `grep`, no criterio

La migración no está hecha cuando "se ve bien". Está hecha cuando estos comandos
devuelven los números de la columna derecha. Los de la izquierda son el estado de hoy,
medidos sobre `src/app` y `styles`, excluyendo specs:

| Comando | Hoy | Al terminar |
|---|---|---|
| `grep -rno 'a-empty' src/app styles` | 31 | 0 |
| `grep -rno 'form-error' src/app styles` | 26 | 0 |
| `grep -rno 'grupos-status' src/app` | 7 | 0 |
| `grep -rno 'dash-status' src/app` | 3 | 0 |
| `grep -rno 'grupos-empty' src/app` | 2 | 0 |
| `grep -rno 'grid-empty' src/app` | 3 | 0 |
| `grep -rno 'foot-error' src/app` | 2 | 0 |
| `grep -rn '\.field-err{' src/app styles` | 2 | 0 |
| `grep -rn '\.error{' src/app` | 4 | 0 |
| `grep -rno 'app-field-error' src/app` | 9 | 9 + los 4 de auth |

Y dos que **no** pueden llegar a cero, para no pasarse de largo:

- `grep -rno 'notice hold' src/app` — hoy 28. Al terminar quedan **sólo las
  advertencias reales** (cupos, `.sess.wait`). Los errores migran a `tone="bad"`. Si
  llega a 0, se borró una advertencia legítima.
- `role="alert"` fuera de los tres primitivos debe quedar en 0 en los sitios
  migrados. El primitivo es el dueño del rol; si el caller también lo declara, el
  lector de pantalla anuncia dos veces.

### 6.3 Los 45 asserts: la regla es el texto, no la clase

El riesgo real de tocar 45 asserts en 23 specs no es que fallen — es que **pasen sin
verificar nada**. Un assert que hoy busca `.a-empty` y mañana busca `app-placeholder`
sigue verde aunque el placeholder haya perdido el mensaje.

Dos reglas, verificables:

1. **El conteo de asserts no baja de 45.** Si un spec queda con menos, se perdió
   cobertura y hay que decir cuál y por qué.
2. **Cada assert migrado verifica el texto visible**, no el selector. Un
   `expect(el.textContent).toContain('Todavía no cargaste ningún alumno')` sobrevive a
   cualquier refactor del markup; un `expect(query('.a-empty')).toBeTruthy()` no
   verifica nada útil y es la razón por la que estos 45 son frágiles hoy.

El spec nuevo de `app-placeholder` cubre los cuatro casos del mapeo `tone → rol`, que
es la única lógica no trivial del primitivo. `app-notice` y `app-field-error` no
llevan spec propio: son markup sin ramas.

### 6.4 Orden de trabajo

Cada paso deja el árbol verde y es revertible solo. El orden no es preferencia: cada
uno depende del anterior y ninguno mezcla cambio visual con cambio de markup.

1. **Assets + favicon.** Sin consumidores nuevos, no rompe nada.
2. **Paleta.** Sólo `tokens.css`. Cambio puramente visual, ningún test lo cubre — por
   eso va **solo en su commit**, para poder revertirlo sin arrastrar nada más.
3. **Tipografía.** Ídem, `tokens.css` + `index.html`.
4. **Brandmark.** Un componente, tres superficies.
5. **Los tres primitivos, con su spec, sin migrar a nadie.** TDD: el spec del mapeo
   `tone → rol` se escribe antes que el componente.
6. **Migración, una página por commit.** 23 specs se actualizan junto a su página, no
   en un commit aparte: así un `npm test` roto señala la página que lo rompió.
7. **404.** Depende de que el primitivo exista.
8. **Barrido final:** los greps de §6.2 y `npm run lint`.

### 6.5 Riesgos concretos

| Riesgo | Por qué es real | Mitigación |
|---|---|---|
| El `sed` que borra la metadata C2PA se come geometría | El bloque `<metadata>` es base64 de ~10KB; un patrón goloso o un segundo `<metadata>` se lleva paths por delante | Después de cortar, verificar que el archivo siga parseando y que el conteo de `<path>` no cambie — el isotipo tiene 9 nodos de dibujo. Es un chequeo de una línea |
| El placeholder se ve más denso dentro del shell | `shell.component.css` redefine la escala `--text-*` en su `:host` (documentado en `CLAUDE.md`), así que el mismo primitivo renderiza distinto en el 404 (dentro del shell) que en auth (fuera) | Verificar `size='page'` en las dos superficies, no en una sola. Es exactamente el caso que la nota de `CLAUDE.md` advierte |
| El logo `<img>` no hereda color | Un `<img>` no responde a `currentColor`: sobre una superficie oscura el logo navy desaparece | Hoy no hay superficie oscura, así que no se resuelve. Queda `ponytail:` en el brandmark nombrando la salida: la variante `01b-isotipo-blanco` del brandboard, que todavía no está en `assets/` |
| El alias `--color-accent-*` toca 17 consumidores sin cobertura | Ningún test mira colores; un consumidor mal migrado no lo detecta nadie | Es el motivo por el que la paleta va sola en su commit (§6.4 paso 2). Revisión visual explícita de los 17, no confianza en el alias |
| Poppins tarda y la tipografía salta | Cambia la familia de todo el body | La URL de Google Fonts mantiene `&display=swap`, que ya está hoy |
| Un vacío migrado pierde la rama de búsqueda | Los 5 `computed` que reemplazan el `@if (query())` son código nuevo donde antes había template | Cada uno de esos 5 lleva un assert de los dos textos, con y sin `query()` |

### 6.6 Lo que no cuenta como terminado

- Los greps de §6.2 sin correr, o corridos y con números distintos a los de la tabla.
- `npm test` o `npm run lint` sin salida pegada. El lint es el único que verifica que
  nadie siga importando `field-error` desde `features/onboarding`.
- Una simplificación tomada sobre la marcha sin comentario `ponytail:` que nombre el
  techo y la salida.
- La revisión visual hecha en una sola superficie: el brandmark vive en shell, auth y
  onboarding, y el placeholder `size='page'` renderiza distinto dentro y fuera del
  shell.

## 7. Fuera de alcance

- **Banner.** No hay asset y se decidió no componer uno.
- **Las piezas que el `LEEME` describe pero no están en la carpeta**: `svg/` y `png/`,
  las variantes blanco y monocromo, los estados responsivos `07a`–`07e`, el
  `08-paleta`. El favicon responsivo es un cambio de una línea cuando aparezcan.
- **Skeletons de carga.** El diseño mantiene el texto que hay hoy, sólo centralizado y
  anunciado. Un sistema de skeletons es otro proyecto.
- **Dark mode.** No existe hoy.
- **El chain `@if (loading) @else if (error) @else` repetido en 9 páginas de lista.**
  Los primitivos no lo tocan. Queda un comentario `ponytail:` en la primera página
  migrada que nombre el techo y la salida: un contenedor `app-async` que reciba la
  facade y proyecte el contenido por `ng-template`. Se descartó ahora porque los
  vacíos no son uniformes — alumnos ramifica por `query()`, reservas por la fecha,
  `grupo-detail` distingue "no existe" de "está vacío" — y un tercio de los casos se
  escaparía de la abstracción, dejando dos formas de hacer lo mismo.
