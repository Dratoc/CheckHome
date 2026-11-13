import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

/** Selector de 2 a 4 opciones: "Hoy / Rutinas / Backlog", "Privado / Compartido". */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: t.colors.surfaceAlt, borderRadius: t.radii.md, padding: t.spacing.xs }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: t.sizes.buttonSm,
              borderRadius: t.radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? t.colors.surface : 'transparent',
              shadowColor: t.colors.shadow,
              ...(selected && t.scheme === 'light' ? t.elevation.card : t.elevation.none),
            }}
          >
            <Text variant="label" color={selected ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
