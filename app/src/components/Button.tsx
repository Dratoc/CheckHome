import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { useTheme, type ColorTokens } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Ocupa todo el ancho disponible */
  block?: boolean;
  /** Ícono opcional a la izquierda del texto */
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const palette: Record<ButtonVariant, { bg: keyof ColorTokens; bgPressed: keyof ColorTokens; fg: keyof ColorTokens }> = {
  primary: { bg: 'primary', bgPressed: 'primaryPressed', fg: 'onPrimary' },
  secondary: { bg: 'surfaceAlt', bgPressed: 'border', fg: 'text' },
  ghost: { bg: 'background', bgPressed: 'surfaceAlt', fg: 'primary' },
  danger: { bg: 'danger', bgPressed: 'danger', fg: 'onDanger' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  block,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const t = useTheme();
  const p = palette[variant];
  const height = size === 'sm' ? t.sizes.buttonSm : size === 'lg' ? t.sizes.buttonLg : t.sizes.buttonMd;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      // Los botones pequeños mantienen un área táctil de 48 aunque se vean más bajos.
      hitSlop={size === 'sm' ? (t.sizes.touchMin - t.sizes.buttonSm) / 2 : undefined}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: size === 'sm' ? t.spacing.md : t.spacing.xl,
          borderRadius: t.radii.md,
          backgroundColor: t.colors[pressed ? p.bgPressed : p.bg],
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : pressed && variant === 'danger' ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.colors[p.fg]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          {icon}
          <Text variant={size === 'lg' ? 'bodyStrong' : 'label'} color={p.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
