import axios from 'axios';

/**
 * One configured HTTP client for the whole app.
 *
 * - Relative base URL ("/api"): in development the Vite proxy forwards it to the
 *   backend, so the browser sees ONE origin and no CORS is needed (U-03, S-07).
 *   Set VITE_API_URL only if the API lives on another origin.
 * - CSRF: the token is fetched once and sent in X-CSRF-Token on every
 *   POST/PUT/DELETE. If the server rejects it (new session), we fetch a fresh
 *   token and retry the request once (S-07).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let csrfToken = null;
let csrfRequest = null;

export const setCsrfToken = (token) => { csrfToken = token || null; };

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = api.get('/auth/csrf')
      .then((res) => { csrfToken = res.data.csrfToken; return csrfToken; })
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

const UNSAFE = ['post', 'put', 'patch', 'delete'];

api.interceptors.request.use(async (config) => {
  if (UNSAFE.includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});

let sessionExpiredHandler = null;
export const setSessionExpiredHandler = (handler) => { sessionExpiredHandler = handler; };

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.csrfToken) csrfToken = response.data.csrfToken; // login/register rotate it
    return response;
  },
  async (error) => {
    const { response, config } = error;
    if (response?.status === 403 && response.data?.code === 'CSRF' && config && !config._csrfRetried) {
      csrfToken = null;
      config._csrfRetried = true;
      return api(config);
    }
    if (response?.status === 401 && ['SESSION_EXPIRED', 'AUTH_REQUIRED'].includes(response.data?.code)) {
      csrfToken = null;
      if (sessionExpiredHandler) sessionExpiredHandler(response.data.error);
    }
    return Promise.reject(error);
  }
);

/** Turns an axios error into a message, plus per-field messages when the server sent them. */
export function readError(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (error?.response?.status === 429) {
    return { message: data?.error || 'Too many attempts. Please wait a moment and try again.', fields: {} };
  }
  return { message: data?.error || fallback, fields: data?.details || {} };
}

export default api;
