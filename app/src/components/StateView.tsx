import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

/** Indicador de carga centrado, para la primera carga de una sección. */
export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xl }}>
      <ActivityIndicator color={t.colors.primary} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

/** Error con opción de reintentar. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xl }}>
      <Text variant="bodyStrong" color="danger" align="center">
        {message}
      </Text>
      {onRetry && <Button label="Reintentar" variant="secondary" size="sm" onPress={onRetry} />}
    </View>
  );
}

/** Lista vacía: qué falta y, si aplica, cómo empezar. */
export function EmptyState({ title, message, action, onAction }: { title: string; message?: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xl, paddingHorizontal: t.spacing.lg }}>
      <Text variant="bodyStrong" align="center">
        {title}
      </Text>
      {message && (
        <Text variant="caption" color="textMuted" align="center">
          {message}
        </Text>
      )}
      {action && <Button label={action} variant="ghost" size="sm" onPress={onAction} />}
    </View>
  );
}

/**
 * Atajo para el patrón carga / error / vacío / contenido.
 * Mientras recarga con datos previos, sigue mostrando el contenido.
 */
export function QueryView<T>({
  query,
  isEmpty,
  empty,
  children,
}: {
  query: { data: T | undefined; loading: boolean; error: string | undefined; reload: () => void };
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.data === undefined) {
    if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />;
    return <LoadingState />;
  }
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
