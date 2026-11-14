import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { useTheme, type ColorTokens } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

const tones = {
  primary: { bg: 'primarySoft', fg: 'primary' },
  points: { bg: 'pointsSoft', fg: 'points' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
  neutral: { bg: 'surfaceAlt', fg: 'textMuted' },
} satisfies Record<string, { bg: keyof ColorTokens; fg: keyof ColorTokens }>;

/** Ícono dentro de un círculo suave, para el lado izquierdo de las filas. */
export function IconCircle({ name, tone = 'neutral' }: { name: IconName; tone?: keyof typeof tones }) {
  const t = useTheme();
  const c = tones[tone];
  const size = t.sizes.avatarMd;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors[c.bg], alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={name} size={20} color={t.colors[c.fg]} />
    </View>
  );
}
