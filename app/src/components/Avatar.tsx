import { View } from 'react-native';
import { useTheme, type ColorTokens } from '../theme';
import { Text } from './Text';

const tones: { bg: keyof ColorTokens; fg: keyof ColorTokens }[] = [
  { bg: 'primarySoft', fg: 'primary' },
  { bg: 'pointsSoft', fg: 'points' },
  { bg: 'warningSoft', fg: 'warning' },
  { bg: 'dangerSoft', fg: 'danger' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Iniciales de un miembro del hogar. El color sale del nombre para que sea siempre el mismo. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const t = useTheme();
  const px = size === 'sm' ? t.sizes.avatarSm : size === 'lg' ? t.sizes.avatarLg : t.sizes.avatarMd;
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const c = tones[hash % tones.length];
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        backgroundColor: t.colors[c.bg],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size === 'lg' ? 'heading' : size === 'sm' ? 'caption' : 'label'} color={c.fg} style={{ fontFamily: t.fontFamily.bold }}>
        {initials(name)}
      </Text>
    </View>
  );
}
