import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Avatar, ícono o casilla a la izquierda */
  leading?: ReactNode;
  /** Monto, badge o acción a la derecha */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Muestra la línea divisoria inferior */
  divider?: boolean;
};

/** Fila de lista: movimientos, obligaciones, miembros, tareas. */
export function ListItem({ title, subtitle, leading, trailing, onPress, divider }: ListItemProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.sizes.touchMin + t.spacing.sm,
        paddingVertical: t.spacing.sm,
        borderBottomWidth: divider ? t.sizes.borderWidth : 0,
        borderBottomColor: t.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: t.spacing.xxs }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}
