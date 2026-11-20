import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

/**
 * Shared collection loader. A monotonically increasing request ID prevents
 * stale responses from replacing newer data after a refresh or unmount.
 */
export function useData(route, active = true) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!active) return;
    const currentRequest = ++requestId.current;
    try {
      const result = await api(route);
      if (currentRequest !== requestId.current) return;
      setData(result.items || []);
      setError(null);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.message);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [route, active]);

  useEffect(() => {
    if (active) reload();
    else setLoading(false);
    return () => { requestId.current += 1; };
  }, [active, reload]);

  return { data, loading, error, reload };
}
