import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  /** Desplazable por defecto */
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/** Contenedor base de cada pantalla: fondo, área segura, barra de estado y márgenes. */
export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const t = useTheme();
  const padding = { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.xl, gap: t.spacing.lg };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView contentContainerStyle={[padding, contentStyle]}>{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
