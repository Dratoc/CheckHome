import { View } from 'react-native';
import { useTheme, type ColorTokens } from '../theme';

/** Barra de avance (rutinas del día, cuotas pagadas). `value` entre 0 y 1. */
export function ProgressBar({
  value,
  tone = 'primary',
  accessibilityLabel,
}: {
  value: number;
  tone?: Extract<keyof ColorTokens, 'primary' | 'points' | 'warning' | 'danger'>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: t.spacing.sm, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: t.radii.pill, backgroundColor: t.colors[tone] }} />
    </View>
  );
}
