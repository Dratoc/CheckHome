import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme, type ColorTokens, type TypographyVariant } from '../theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
};

/** Texto con la escala tipográfica del tema. Usar siempre en lugar del Text de React Native. */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const t = useTheme();
  const isOverline = variant === 'overline';
  return (
    <RNText
      {...rest}
      style={[
        t.typography[variant],
        { color: t.colors[color], textAlign: align },
        isOverline && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
