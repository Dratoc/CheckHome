# Sistema de diseño de CheckHome

Fuente de verdad en código: `app/src/theme/` (tokens) y `app/src/components/` (componentes base).
Vitrina para revisarlos en claro y oscuro: `app/src/screens/DesignPreview.tsx` (`npm run web` o Expo Go).

## Estilo

Moderno y tranquilo: fondos cálidos casi blancos, tarjetas redondeadas con sombra suave, un verde
azulado como color de marca y violeta para todo lo que son puntos y tareas. Mucho aire, poco borde.
En modo oscuro las tarjetas se separan con un borde fino en vez de sombra.

## Colores (`colors.ts`)

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `background` | `#F7F6F3` | `#0F1211` | Fondo de pantalla |
| `surface` | `#FFFFFF` | `#181C1B` | Tarjetas y campos |
| `surfaceAlt` | `#EFEDE8` | `#222726` | Botón secundario, selector, chips neutros |
| `border` | `#E3E0DA` | `#2D3331` | Divisores y bordes |
| `text` / `textMuted` / `textSubtle` | `#1A1D1C` / `#5F6663` / `#8A908D` | `#F1F3F2` / `#A6AEAB` / `#78817E` | Texto principal, secundario, placeholder |
| `primary` | `#0B7A5E` | `#3DD1A4` | Marca, acción principal, Cuentas |
| `primarySoft` | `#DDF3EC` | `#12352B` | Tarjeta de balance, fondos suaves |
| `points` / `pointsSoft` | `#5B45C2` / `#ECE8FC` | `#B3A4F7` / `#2A2447` | Tareas y puntos |
| `success` | `#0B7A5E` | `#3DD1A4` | Ingresos, "Al día" |
| `warning` | `#8A6100` | `#F5B44A` | "Vence pronto" |
| `danger` | `#B42318` | `#FF7A6E` | "Atrasado", eliminar, errores |

Todos los pares texto/fondo usados cumplen contraste WCAG AA (≥ 4.5:1).

## Tipografía (`typography.ts`)

Plus Jakarta Sans (Google Fonts, gratis). Variantes: `display` 36, `title` 26, `heading` 18, `body` 16,
`bodyStrong` 16, `label` 14, `caption` 13, `overline` 12 y `amount` 16. Los montos usan números de ancho fijo.

## Espaciado, radios y tamaños (`tokens.ts`)

- Espaciado en múltiplos de 4: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`.
- Radios: `sm 8`, `md 12` (botones, campos), `lg 16` (tarjetas), `xl 24`, `pill`.
- Área táctil mínima 48 (Android). Botones de 40, 48 y 56 de alto.

## Componentes (`app/src/components/`)

| Componente | Para qué |
| --- | --- |
| `Screen` | Contenedor de pantalla: fondo, área segura, barra de estado, márgenes |
| `Text` | Todo texto, con `variant` y `color` del tema |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; tamaños `sm`, `md`, `lg`; `loading` y `disabled` |
| `Card` | Agrupa contenido; tonos `default`, `tinted` (balance) y `points` (tareas) |
| `Badge` | Estado: Al día, Vence pronto, Atrasado, puntos |
| `TextField` | Campo con etiqueta, ayuda, error y prefijo (`$`) |
| `ListItem` | Fila de movimientos, obligaciones, miembros |
| `Checkbox` | Rutinas del día; toda la fila es tocable |
| `ProgressBar` | Avance del checklist o de cuotas |
| `Amount` | Monto en CLP; ingresos en verde con "+" |
| `Avatar` | Iniciales del miembro, color estable según el nombre |
| `SegmentedControl` | Pestañas internas (Hoy / Rutinas / Backlog) |
| `SectionHeader` | Título de sección con acción "Ver todo" |
| `Fab` | Botón flotante "+ Gasto" |

## Reglas

1. Ningún color, tamaño o margen a mano: siempre desde `useTheme()`.
2. Modo claro y oscuro desde el inicio; por defecto sigue al teléfono.
3. `accessibilityLabel` en todo botón sin texto claro; áreas táctiles ≥ 48.
4. Textos cortos y en español, pensados para la familia.
