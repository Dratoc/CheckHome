import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

/** Botón flotante (ej. "+ Gasto"). Va abajo a la derecha, sobre las pestañas. */
export function Fab({ label, onPress, accessibilityLabel }: { label: string; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        height: t.sizes.fab,
        paddingHorizontal: t.spacing.xl,
        borderRadius: t.radii.pill,
        backgroundColor: pressed ? t.colors.primaryPressed : t.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-end',
        shadowColor: t.colors.shadow,
        ...t.elevation.floating,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text variant="heading" color="onPrimary">
          +
        </Text>
        <Text variant="bodyStrong" color="onPrimary">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
