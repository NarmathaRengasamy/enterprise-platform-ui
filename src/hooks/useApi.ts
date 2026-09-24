import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export interface UseApiOptions {
  /* Holds the request back until a precondition is met — e.g. the Developer Hub
     does not ask for agents until the platform connection exists, so a gated
     409 never reaches the user as an error. Defaults to true. */
  enabled?: boolean;
}

/* Runs `fetcher` on mount and whenever `deps` change.

   A request that is superseded (filters changed mid-flight) is discarded rather than
   allowed to overwrite newer state, so fast typing in a search box can't render a
   stale result. */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  /* Starts loading only if it is going to fetch — a disabled hook that reported
     `loading` would leave the caller on a spinner for ever. */
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /* Identifies the newest request; older ones bail out on return. */
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      /* Invalidate any in-flight request so its result can't land after the
         hook has been switched off. */
      requestId.current += 1;
      setLoading(false);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled || id !== requestId.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled || id !== requestId.current) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong loading this data.');
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, refetch, setData };
}

/* Debounces a value — used so each keystroke in a search box doesn't hit the API. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
