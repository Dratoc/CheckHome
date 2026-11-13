import { View } from 'react-native';
import { useTheme, type ColorTokens } from '../theme';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'points';

const tones: Record<BadgeTone, { bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  neutral: { bg: 'surfaceAlt', fg: 'textMuted' },
  primary: { bg: 'primarySoft', fg: 'primary' },
  success: { bg: 'successSoft', fg: 'success' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
  points: { bg: 'pointsSoft', fg: 'points' },
};

/** Etiqueta de estado: "Al día", "Vence en 3 días", "Atrasado", "+5 pts". */
export function Badge({ label, tone = 'neutral', dot }: { label: string; tone?: BadgeTone; dot?: boolean }) {
  const t = useTheme();
  const c = tones[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: t.spacing.xs,
        backgroundColor: t.colors[c.bg],
        borderRadius: t.radii.pill,
        paddingHorizontal: t.spacing.sm + t.spacing.xxs,
        paddingVertical: t.spacing.xxs + 1,
      }}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors[c.fg] }} />}
      <Text variant="caption" color={c.fg} style={{ fontFamily: t.fontFamily.semibold }}>
        {label}
      </Text>
    </View>
  );
}
