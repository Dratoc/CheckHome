import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ColorTokens } from './colors';
import { elevation, radii, sizes, spacing, motion } from './tokens';
import { typography, fontFamily } from './typography';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  elevation: typeof elevation;
  motion: typeof motion;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
};

type ThemeContextValue = Theme & {
  preference: ColorSchemePreference;
  setPreference: (p: ColorSchemePreference) => void;
};

export function buildTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    sizes,
    elevation,
    motion,
    typography,
    fontFamily,
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Entrega el tema a toda la app. Por defecto sigue el modo del teléfono. */
export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ColorSchemePreference;
}) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ColorSchemePreference>(initialPreference);
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(scheme), preference, setPreference }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
