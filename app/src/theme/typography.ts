import type { TextStyle } from 'react-native';

/**
 * Tipografía: Plus Jakarta Sans (Google Fonts, licencia OFL, gratis).
 * Se carga en `useAppFonts`. Si aún no carga, React Native usa la fuente del sistema.
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

type Variant = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'> & {
  fontVariant?: TextStyle['fontVariant'];
};

/** Escala tipográfica. Usar la variante, nunca tamaños sueltos. */
export const typography = {
  /** Montos grandes (balance del mes) */
  display: { fontFamily: fontFamily.extrabold, fontSize: 36, lineHeight: 44, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  /** Título de pantalla */
  title: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  /** Título de sección o tarjeta */
  heading: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  /** Botones, chips, etiquetas de campos */
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  /** Ayudas, fechas, metadatos */
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  /** Encabezados pequeños en mayúscula */
  overline: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  /** Montos en listas */
  amount: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, Variant>;

export type TypographyVariant = keyof typeof typography;
