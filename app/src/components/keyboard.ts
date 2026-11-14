import { createContext, useContext } from 'react';
import { Keyboard, Platform, type HostInstance, type KeyboardEvent } from 'react-native';

/** Espacio libre que se deja entre el campo activo y el borde del teclado. */
export const KEYBOARD_GAP = 24;

/**
 * Lo que el contenedor de la pantalla ofrece a sus campos: al enfocarse, un campo le pide que lo deje
 * a la vista sobre el teclado.
 */
export type KeyboardAware = { reveal: (field: HostInstance | null) => void };

export const KeyboardAwareContext = createContext<KeyboardAware | null>(null);

export const useKeyboardAware = () => useContext(KeyboardAwareContext);

/**
 * Avisa cada vez que cambia el borde superior del teclado, en coordenadas de la ventana.
 * `null` significa que no hay teclado.
 *
 * - Android/iOS nativo: eventos de `Keyboard` (en Android solo llegan los "Did").
 * - Web (PWA en iPhone y Chrome en Android): el teclado achica el `visualViewport`; su borde inferior es
 *   el borde superior del teclado.
 */
export function subscribeKeyboardTop(onChange: (top: number | null) => void): () => void {
  if (Platform.OS === 'web') {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return () => {};
    const update = () => {
      const hidden = document.documentElement.clientHeight - vv.height;
      // Menos de ~100 px de diferencia es la barra del navegador, no un teclado.
      onChange(hidden > 100 ? vv.offsetTop + vv.height : null);
    };
    // window.resize: en Chrome de Android con interactive-widget=resizes-content la página entera se achica.
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }
  const show = (e: KeyboardEvent) => onChange(e.endCoordinates.screenY);
  const hide = () => onChange(null);
  const subs = [
    Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show),
    Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
  ];
  return () => subs.forEach((s) => s.remove());
}

/** Mide una vista en coordenadas de la ventana. */
export const measure = (view: HostInstance) =>
  new Promise<{ y: number; height: number }>((resolve) => view.measureInWindow((_x, y, _w, height) => resolve({ y, height })));
