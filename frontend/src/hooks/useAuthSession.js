import { useCallback, useEffect, useState } from 'react';
import { api, post, savedToken } from '../api.js';

const STORAGE_KEY = 'cp_token';

/**
 * Owns session persistence and session-expiry handling.
 * Feature pages never read or mutate the authentication token directly.
 */
export function useAuthSession() {
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    window.addEventListener('cp-unauthorized', clearSession);
    return () => window.removeEventListener('cp-unauthorized', clearSession);
  }, [clearSession]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoading(true);
    api('me')
      .then(({ user: account }) => {
        if (!cancelled) setUser(account);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, clearSession]);

  const signIn = useCallback((accessToken, account) => {
    localStorage.setItem(STORAGE_KEY, accessToken);
    setUser(account);
    setToken(accessToken);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await post('logout', {});
    } catch {
      // Clear local credentials even when the server is temporarily offline.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return { user, loading, signIn, signOut };
}
