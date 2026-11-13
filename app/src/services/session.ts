import * as SecureStore from 'expo-secure-store';
import type { MyHousehold, User } from './types';

/**
 * Sesión guardada en el almacenamiento seguro del teléfono: el JWT (30 días), el usuario y el último hogar
 * elegido. Así la app no pide login en cada apertura.
 */
const KEY = 'checkhome.session.v1';

export type StoredSession = { token: string; user: User; household?: MyHousehold };

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: StoredSession | null) {
  try {
    if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Sin almacenamiento seguro (por ejemplo en web) la sesión dura mientras la app esté abierta.
  }
}
