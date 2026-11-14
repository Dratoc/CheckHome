import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type Choice<T extends string | number> = { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

type ChoiceChipsProps<T extends string | number> = {
  label: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  error?: string;
};

/** Grupo de chips de selección única (tipo de cuenta, puntos, etc.). */
export function ChoiceChips<T extends string | number>({ label, options, value, onChange, error }: ChoiceChipsProps<T>) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                minHeight: t.sizes.touchMin,
                paddingHorizontal: t.spacing.md,
                borderRadius: t.radii.pill,
                backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {o.icon && <Ionicons name={o.icon} size={18} color={selected ? t.colors.onPrimary : t.colors.textMuted} />}
              <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error && (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}
    </View>
  );
}
