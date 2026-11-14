/** Espaciado en múltiplos de 4. Usar siempre estos valores para márgenes y rellenos. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Radios de esquina. Tarjetas usan `lg`, botones y campos `md`, chips `pill`. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Tamaños mínimos para que todo sea fácil de tocar (Android recomienda 48). */
export const sizes = {
  touchMin: 48,
  buttonSm: 40,
  buttonMd: 48,
  buttonLg: 56,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  fab: 60,
  borderWidth: 1,
  focusWidth: 2,
} as const;

/** Elevación sutil para modo claro. En oscuro las superficies se separan con borde. */
export const elevation = {
  none: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  card: { shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  floating: { shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

export const motion = {
  fast: 120,
  normal: 200,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radii;
