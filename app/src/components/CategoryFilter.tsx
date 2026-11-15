import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView } from 'react-native';
import type { TaskCategory } from '../services/types';
import { useTheme } from '../theme';
import { CATEGORIES } from '../utils/categories';
import { Text } from './Text';

type CategoryFilterProps = {
  /** undefined = todas */
  value: TaskCategory | undefined;
  onChange: (v: TaskCategory | undefined) => void;
  /** Cuántas tareas hay por categoría: solo se muestran las que tienen alguna */
  counts: Partial<Record<TaskCategory, number>>;
};

/**
 * Filtro de tareas por categoría: una fila de píldoras con ícono que se desliza de lado. Solo aparecen las categorías
 * que tienen tareas, para que no sea una lista larga de opciones vacías. Tocar la elegida vuelve a "Todas".
 */
export function CategoryFilter({ value, onChange, counts }: CategoryFilterProps) {
  const t = useTheme();
  const present = CATEGORIES.filter((c) => (counts[c.value] ?? 0) > 0 || c.value === value);
  if (present.length < 2 && value === undefined) return null;

  const pill = (key: string, label: string, selected: boolean, onPress: () => void, icon?: keyof typeof Ionicons.glyphMap, count?: number) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        minHeight: t.sizes.buttonSm,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.pill,
        backgroundColor: selected ? t.colors.points : t.colors.surfaceAlt,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? t.colors.surface : t.colors.textMuted} />}
      <Text variant="label" color={selected ? 'surface' : 'text'}>
        {label}
      </Text>
      {count !== undefined && (
        <Text variant="caption" color={selected ? 'surface' : 'textMuted'}>
          {count}
        </Text>
      )}
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Filtrar por categoría"
      contentContainerStyle={{ gap: t.spacing.sm, paddingHorizontal: t.spacing.lg }}
      style={{ marginHorizontal: -t.spacing.lg, flexGrow: 0 }}
    >
      {pill('all', 'Todas', value === undefined, () => onChange(undefined))}
      {present.map((c) => pill(c.value, c.label, value === c.value, () => onChange(value === c.value ? undefined : c.value), c.icon, counts[c.value] ?? 0))}
    </ScrollView>
  );
}

/** Cuenta cuántas hay por categoría (las sin categoría no cuentan). */
export function countByCategory(items: { category?: TaskCategory }[]) {
  const counts: Partial<Record<TaskCategory, number>> = {};
  for (const i of items) if (i.category) counts[i.category] = (counts[i.category] ?? 0) + 1;
  return counts;
}
