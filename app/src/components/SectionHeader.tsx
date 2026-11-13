import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

/** Título de sección con acción opcional a la derecha ("Ver todo"). */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={t.spacing.md}>
          <Text variant="label" color="primary">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
