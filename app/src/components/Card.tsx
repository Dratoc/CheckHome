import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme, type Spacing } from '../theme';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  padding?: Spacing;
  /** Variante de tono: `tinted` usa el verde suave de marca (ej. tarjeta de balance) */
  tone?: 'default' | 'tinted' | 'points';
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** Superficie elevada para agrupar contenido. Si tiene `onPress` se comporta como botón. */
export function Card({ children, onPress, padding = 'lg', tone = 'default', accessibilityLabel, style }: CardProps) {
  const t = useTheme();
  const bg = tone === 'tinted' ? t.colors.primarySoft : tone === 'points' ? t.colors.pointsSoft : t.colors.surface;
  const isDark = t.scheme === 'dark';
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: t.radii.lg,
    padding: t.spacing[padding],
    gap: t.spacing.sm,
    borderWidth: isDark && tone === 'default' ? t.sizes.borderWidth : 0,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
    ...(isDark || tone !== 'default' ? t.elevation.none : t.elevation.card),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}
