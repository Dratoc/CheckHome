import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { MyHousehold, User } from './types';

/**
 * Sesión guardada en el almacenamiento seguro del teléfono: el JWT (30 días), el usuario y el último hogar
 * elegido. Así la app no pide login en cada apertura. En la versión web (iPhone desde la pantalla de inicio)
 * no hay almacenamiento seguro, así que se usa localStorage del navegador.
 */
const KEY = 'checkhome.session.v1';

const store =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        deleteItemAsync: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : SecureStore;

export type StoredSession = { token: string; user: User; household?: MyHousehold };

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await store.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: StoredSession | null) {
  try {
    if (s) await store.setItemAsync(KEY, JSON.stringify(s));
    else await store.deleteItemAsync(KEY);
  } catch {
    // Sin almacenamiento disponible (por ejemplo, navegación privada) la sesión dura mientras la app esté abierta.
  }
}
