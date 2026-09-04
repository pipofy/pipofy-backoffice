# Pipofy — sistema de logos vectoriales

Reconstrucción vectorial completa del brandboard. Ningún archivo es un recorte
de la imagen original: cada forma (la P, la pala, las perforaciones, la pelota,
la estela, el escudo) está dibujada como geometría SVG y escala sin pérdida a
cualquier tamaño, desde un favicon de 16 px hasta una lona.

El texto está convertido a trazados, así que los archivos se ven idénticos en
cualquier equipo, tenga o no la fuente instalada.

## Qué hay en cada carpeta

- `svg/` — los originales editables (Illustrator, Figma, Inkscape, web).
- `png/` — exportaciones en alta resolución con fondo transparente.
- `00-vista-general.png` — todas las piezas en una sola hoja.

## Piezas

| Archivo | Para qué |
|---|---|
| `01-isotipo` | La marca sola, sin texto. Redes, sellos, marcas de agua. |
| `01b-isotipo-blanco` | Sobre fondos oscuros. |
| `01c-isotipo-monocromo-navy` | Un solo color: bordados, serigrafía, fax, grabado. |
| `02-logo-vertical` | Bloqueo principal. Cartelería, camisetas, firmas. |
| `03-logo-horizontal` | Formatos anchos: cabeceras, membretes, presentaciones. |
| `04-logo-cabecera-web` | Con el descriptor "Pádel Academia", como en el brandboard. |
| `05-logo-backoffice` | Emblema en escudo + "Backoffice \| Management". |
| `05b-emblema-escudo` | El escudo aislado. |
| `06-app-icon` | Icono de app con degradado (1024×1024). |
| `06b-app-icon-plano` | Versión plana, para iconos maskable de Android. |
| `07a` … `07e` | Estados responsivos, de más a menos detalle. |
| `08-paleta-y-tipografia` | Referencia de color y tipografía. |

## Estados responsivos

La marca pierde detalle a medida que se reduce, para que nunca se empaste:

1. `07a-marca-completa` — más de 80 px: pelota, estela y perforaciones.
2. `07b-marca-sin-estela` — 48 a 80 px.
3. `07c-marca-reducida` — 32 a 48 px: sólo P y pala.
4. `07d-favicon` — 48 a 64 px, dentro del cuadro.
5. `07e-favicon-minimo` — 16 a 32 px: sólo la P.

Los PNG `favicon-16` a `favicon-512` y `app-icon-120` a `app-icon-1024` ya están
generados en los tamaños que piden iOS, Android y los navegadores.

## Color

| Nombre | Hex | Uso |
|---|---|---|
| Primary | `#082658` | Color de marca. Textos, la P, fondos oscuros. |
| Web Blue | `#2267AC` | Pelota, escudo, enlaces y acentos de interfaz. |
| Accent | `#6DB5E5` | Realces sobre fondo oscuro, gráficos, estados activos. |
| Neutral | `#ABB4BD` | Descriptores secundarios, separadores, texto deshabilitado. |
| White | `#FFFFFF` | La pala, fondos, contraste. |

Degradado del icono: `#0A2A63` → `#1B5595` → `#2E78C0`, en diagonal.

## Tipografía

El brandboard nombraba "Pipofy Sans", que no corresponde a ninguna fuente
publicada. El sistema está construido con **Poppins**, geométrica y de licencia
libre (SIL Open Font License), que es la que más se acerca al dibujo original.
Se descarga gratis desde Google Fonts.

- Poppins Bold — logotipo y titulares.
- Poppins Medium — títulos de sección e interfaz.
- Poppins Light / Regular — descriptores y texto corrido.

## Área de respeto

Deja alrededor del logo un margen libre igual a la altura de la P. Nada de otros
elementos, texto ni bordes dentro de esa zona.

## Qué no hacer

No estires el logo sin mantener la proporción, no cambies los colores de la
paleta, no rotes la marca, no le pongas sombras ni contornos, y no coloques la
versión a color sobre fondos que no den contraste suficiente: para eso están
las versiones en blanco y monocromo.
