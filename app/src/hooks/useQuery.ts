import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type QueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => Promise<void>;
};

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.';
}

/**
 * Carga datos al mostrar la pantalla y los vuelve a cargar cada vez que recupera el foco
 * (por ejemplo, al volver de "+ Gasto"). Mantiene los datos anteriores mientras recarga.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await run();
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loading, error, reload };
}

/** Ejecuta una acción (guardar, pagar, votar) y expone su estado. */
export function useMutation<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(undefined);
      try {
        return await action(...args);
      } catch (e) {
        setError(errorMessage(e));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [action],
  );
  return { run, pending, error, setError };
}
