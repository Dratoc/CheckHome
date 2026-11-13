import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  /** Desplazable por defecto */
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Bordes con área segura. En pestañas basta 'top'; bajo un encabezado de navegación, ninguno arriba. */
  edges?: Edge[];
  /** Elemento fijo sobre el contenido, ej. el botón "+ Gasto" */
  overlay?: ReactNode;
};

/** Contenedor base de cada pantalla: fondo, área segura, barra de estado y márgenes. */
export function Screen({ children, scroll = true, contentStyle, edges, overlay }: ScreenProps) {
  const t = useTheme();
  const padding = { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.xl, gap: t.spacing.lg };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[padding, overlay ? { paddingBottom: t.sizes.fab + t.spacing.xxl } : null, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {overlay && <View style={{ position: 'absolute', right: t.spacing.lg, bottom: t.spacing.lg }}>{overlay}</View>}
    </SafeAreaView>
  );
}
