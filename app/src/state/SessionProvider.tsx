import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import type { MyHousehold, User } from '../services/types';

type SessionValue = {
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
 * Sesión simulada en memoria. Con la API real guardará el JWT (30 días) en almacenamiento seguro
 * y el último hogar elegido, para no pedir login en cada apertura.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<MyHousehold | null>(null);

  const register = useCallback(async (input: api.RegisterInput) => {
    setUser(await api.register(input));
    setHousehold(null);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setUser(await api.login(identifier, password));
    setHousehold(null);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setHousehold(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      household,
      register,
      login,
      logout,
      selectHousehold: setHousehold,
      leaveCurrentHousehold: () => setHousehold(null),
    }),
    [user, household, register, login, logout],
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
