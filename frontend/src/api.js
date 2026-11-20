/**
 * Centralized HTTP client for the PHP backend.
 * The Vite development proxy and production PHP path share the same route API.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api/api.php' : '/campus_parking/backend/api.php'
);
const TOKEN_KEY = 'cp_token';

export const savedToken = () => localStorage.getItem(TOKEN_KEY);

function buildUrl(route, params = {}) {
  const query = new URLSearchParams({ route, ...params });
  return `${API_BASE_URL}?${query.toString()}`;
}

function authHeaders() {
  const token = savedToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Request JSON while preserving meaningful server error messages. */
export async function api(route, options = {}) {
  let response;
  try {
    response = await fetch(buildUrl(route, options.params), {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
    });
  } catch {
    throw new Error('Unable to reach PHP. Check Apache, MySQL, and the XAMPP project path.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`PHP returned an invalid response (HTTP ${response.status}). Check the backend URL.`);
  }

  if (!response.ok) {
    // Authentication requests must surface 401 as an error, not sign out other users.
    if (response.status === 401 && route !== 'login') {
      window.dispatchEvent(new Event('cp-unauthorized'));
    }
    throw new Error(result.error || `Request failed (HTTP ${response.status})`);
  }
  return result;
}

export const post = (route, data) => api(route, { method: 'POST', data });

/** Protected binary endpoint used for optional server-generated QR SVGs. */
export async function apiBlob(route, params = {}) {
  const response = await fetch(buildUrl(route, params), { headers: authHeaders() });
  if (!response.ok) {
    let message = 'QR image unavailable';
    try { message = (await response.json()).error || message; } catch { /* server returned a non-JSON error */ }
    throw new Error(message);
  }
  return response.blob();
}
