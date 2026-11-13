import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  error?: string;
  /** Texto fijo a la izquierda, ej. "$" para montos */
  prefix?: string;
};

/** Campo de texto con etiqueta, ayuda y error. */
export function TextField({ label, hint, error, prefix, onFocus, onBlur, ...rest }: TextFieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.danger : focused ? t.colors.primary : t.colors.border;

  return (
    <View style={{ gap: t.spacing.xs + t.spacing.xxs }}>
      <Text variant="label" color="text">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: t.sizes.buttonMd,
          paddingHorizontal: t.spacing.md,
          gap: t.spacing.xs,
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.md,
          borderWidth: focused || error ? t.sizes.focusWidth : t.sizes.borderWidth,
          borderColor,
        }}
      >
        {prefix && (
          <Text variant="bodyStrong" color="textMuted">
            {prefix}
          </Text>
        )}
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={t.colors.textSubtle}
          selectionColor={t.colors.primary}
          cursorColor={t.colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[t.typography.body, { flex: 1, color: t.colors.text, paddingVertical: t.spacing.sm }]}
        />
      </View>
      {(error || hint) && (
        <Text variant="caption" color={error ? 'danger' : 'textMuted'}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
