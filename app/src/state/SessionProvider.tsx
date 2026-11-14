import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import { loadSession, saveSession } from '../services/session';
import type { MyHousehold, User } from '../services/types';

type SessionValue = {
  /** true mientras se lee la sesión guardada al abrir la app */
  restoring: boolean;
  user: User | null;
  household: MyHousehold | null;
  register: (input: api.RegisterInput) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  selectHousehold: (h: MyHousehold) => void;
  /** Vuelve a la pantalla "Elegir hogar" */
  leaveCurrentHousehold: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Sesión con la API real: guarda el JWT (30 días), el usuario y el último hogar en almacenamiento seguro,
 * para no pedir login en cada apertura. Si el servidor responde 401, cierra la sesión.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [restoring, setRestoring] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<MyHousehold | null>(null);

  const logout = useCallback(() => {
    api.setToken(null);
    setTokenState(null);
    setUser(null);
    setHousehold(null);
    saveSession(null);
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(logout);
    loadSession().then((s) => {
      if (s) {
        api.setToken(s.token);
        setTokenState(s.token);
        setUser(s.user);
        setHousehold(s.household ?? null);
      }
      setRestoring(false);
    });
    return () => api.setUnauthorizedHandler(null);
  }, [logout]);

  // Guarda cada cambio de usuario u hogar.
  useEffect(() => {
    if (!restoring && token && user) saveSession({ token, user, household: household ?? undefined });
  }, [restoring, token, user, household]);

  const start = useCallback((r: api.AuthResult) => {
    api.setToken(r.token);
    setTokenState(r.token);
    setUser(r.user);
    setHousehold(null);
  }, []);

  const register = useCallback(async (input: api.RegisterInput) => start(await api.register(input)), [start]);

  const login = useCallback(
    async (identifier: string, password: string) => start(await api.login(identifier, password)),
    [start],
  );

  const value = useMemo<SessionValue>(
    () => ({
      restoring,
      user,
      household,
      register,
      login,
      logout,
      selectHousehold: setHousehold,
      leaveCurrentHousehold: () => setHousehold(null),
    }),
    [restoring, user, household, register, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}

/** Para pantallas que solo existen con sesión y hogar elegidos. */
export function useHousehold() {
  const { user, household } = useSession();
  if (!user || !household) throw new Error('Esta pantalla requiere sesión y hogar');
  return { user, household };
}
