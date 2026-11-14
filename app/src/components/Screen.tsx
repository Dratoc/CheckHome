import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, type HostInstance, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme';
import { KEYBOARD_GAP, KeyboardAwareContext, measure, subscribeKeyboardTop, type KeyboardAware } from './keyboard';

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

/**
 * Contenedor base de cada pantalla: fondo, área segura, barra de estado y márgenes.
 *
 * Si es desplazable, también cuida el teclado: deja espacio al final del contenido del alto que tapa el
 * teclado y desplaza la pantalla para que el campo que se está llenando quede a la vista. Funciona igual
 * en el APK de Android y en la versión web del iPhone.
 */
export function Screen({ children, scroll = true, contentStyle, edges, overlay }: ScreenProps) {
  const t = useTheme();
  const padding = { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.xl, gap: t.spacing.lg };

  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const focused = useRef<HostInstance | null>(null);
  const [keyboardSpace, setKeyboardSpace] = useState(0);

  /** Desplaza lo justo para que el campo enfocado quede entre el borde superior y el teclado. */
  const ensureVisible = useCallback(async () => {
    const field = focused.current;
    const box = scrollRef.current;
    if (!field || !box) return;
    const [area, f] = await Promise.all([measure(box), measure(field)]);
    const top = area.y + KEYBOARD_GAP;
    const bottom = Math.min(area.y + area.height, keyboardTop.current ?? Infinity) - KEYBOARD_GAP;
    let delta = 0;
    if (f.y + f.height > bottom) delta = Math.min(f.y + f.height - bottom, f.y - top);
    else if (f.y < top) delta = f.y - top;
    if (Math.abs(delta) < 1) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
  }, []);

  useEffect(() => {
    if (!scroll) return;
    return subscribeKeyboardTop(async (top) => {
      keyboardTop.current = top;
      const box = scrollRef.current;
      if (top === null || !box) {
        setKeyboardSpace(0);
        return;
      }
      const area = await measure(box);
      setKeyboardSpace(Math.max(0, Math.round(area.y + area.height - top)));
      // Espera a que el espacio extra esté dibujado antes de desplazar.
      setTimeout(ensureVisible, 50);
    });
  }, [scroll, ensureVisible]);

  const keyboardAware = useMemo<KeyboardAware>(
    () => ({
      reveal: (field) => {
        focused.current = field;
        // Si el teclado ya está abierto (cambio de un campo a otro) se desplaza al tiro; si no, lo hace
        // cuando el teclado avisa que apareció.
        if (keyboardTop.current !== null) setTimeout(ensureVisible, 50);
      },
    }),
    [ensureVisible],
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <KeyboardAwareContext.Provider value={keyboardAware}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              offset.current = e.nativeEvent.contentOffset.y;
            }}
            contentContainerStyle={[
              padding,
              overlay ? { paddingBottom: t.sizes.fab + t.spacing.xxl } : null,
              contentStyle,
              keyboardSpace > 0 ? { paddingBottom: keyboardSpace + KEYBOARD_GAP } : null,
            ]}
          >
            {children}
          </ScrollView>
        </KeyboardAwareContext.Provider>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {overlay && <View style={{ position: 'absolute', right: t.spacing.lg, bottom: t.spacing.lg }}>{overlay}</View>}
    </SafeAreaView>
  );
}
