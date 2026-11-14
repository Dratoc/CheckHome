import { useState } from 'react';
import * as api from '../services/api';
import type { RoutineWithCheck } from '../services/api';
import { errorMessage } from './useQuery';

/** Marca o desmarca una rutina al instante y confirma con la API; si falla, vuelve atrás. */
export function useRoutineToggle(userId: number, reload: () => Promise<void>) {
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string>();

  const isChecked = (r: RoutineWithCheck) => optimistic[r.id] ?? r.doneBy !== undefined;

  const toggle = async (r: RoutineWithCheck) => {
    setError(undefined);
    setOptimistic((o) => ({ ...o, [r.id]: !isChecked(r) }));
    try {
      await api.toggleRoutine(r.id, userId);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOptimistic((o) => {
        const { [r.id]: _, ...rest } = o;
        return rest;
      });
    }
  };

  return { isChecked, toggle, error };
}
