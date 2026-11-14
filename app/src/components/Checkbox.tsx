import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Texto pequeño bajo la etiqueta, ej. "+3 pts" o "Le toca a Ana" */
  hint?: string;
};

/** Casilla para rutinas del día. Toda la fila es tocable. */
export function Checkbox({ checked, onChange, label, hint }: CheckboxProps) {
  const t = useTheme();
  const box = 26;
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.sizes.touchMin,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: box,
          height: box,
          borderRadius: t.radii.sm,
          borderWidth: t.sizes.focusWidth,
          borderColor: checked ? t.colors.primary : t.colors.textSubtle,
          backgroundColor: checked ? t.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          // Visto dibujado con bordes para no depender de una librería de íconos.
          <View
            style={{
              width: 7,
              height: 13,
              borderRightWidth: 2.5,
              borderBottomWidth: 2.5,
              borderColor: t.colors.onPrimary,
              transform: [{ rotate: '45deg' }],
              marginTop: -3,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyStrong"
          color={checked ? 'textMuted' : 'text'}
          style={checked ? { textDecorationLine: 'line-through' } : undefined}
        >
          {label}
        </Text>
        {hint && (
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
