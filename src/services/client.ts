import { ApiFieldError, ApiResponse } from '../types/auth.types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5050/api/v1';

export const TOKEN_KEY = 'perfox_auth_token';

// Supported storage keys for backward compatibility across modules
const KNOWN_TOKEN_KEYS = [
  'perfox_auth_token',
  'omniflow_auth_token',
  'token',
  'authToken',
  'auth_token',
];

export const getToken = (): string | null => {
  try {
    for (const key of KNOWN_TOKEN_KEYS) {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (val && val.trim()) {
        return val.trim();
      }
    }
  } catch (e) {
    console.warn('Could not read token from storage:', e);
  }
  return null;
};

export const setToken = (token: string, rememberMe = true): void => {
  try {
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem('token', token);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('token');
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem('token', token);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('token');
    }
  } catch (e) {
    console.warn('Could not save token to storage:', e);
  }
};

export const clearToken = (): void => {
  try {
    for (const key of KNOWN_TOKEN_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Could not clear token from storage:', e);
  }
};

export interface RequestOptions extends RequestInit {
  data?: any;
  params?: Record<string, any>;
  skipAuth?: boolean;
}

/**
 * What `request` throws. `status` carries the HTTP code so a caller can tell a
 * 409 ("Perfox is not connected yet") from a 403 ("you are not an Admin") from
 * a genuine server failure — the message alone cannot be branched on safely.
 * It is absent when the request never reached the server.
 */
export interface ApiError extends Error {
  status?: number;
  /** On a 400, the validation failures keyed by field name, so a form can mark
      the inputs that were rejected instead of showing one opaque banner. */
  fieldErrors?: Record<string, string>;
}

/**
 * Turns the API's `errors` array into a lookup a form can use.
 *
 * Paths arrive dotted and prefixed with their source — `body.url`,
 * `query.page`, `params.id`. The prefix is about where the value travelled, not
 * what the user typed, so it is stripped: a form knows its field as `url`.
 * The first failure per field wins; later ones are usually refinements of it.
 */
const fieldErrorsFrom = (errors?: ApiFieldError[]): Record<string, string> => {
  if (!Array.isArray(errors)) return {};

  const result: Record<string, string> = {};
  for (const entry of errors) {
    if (!entry?.path || !entry?.message) continue;
    const field = entry.path.replace(/^(body|query|params)\./, '');
    if (!(field in result)) result[field] = entry.message;
  }
  return result;
};

export async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Append query params if provided
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const token = options.skipAuth ? null : getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Merge any custom headers passed in options
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // If payload is FormData, let fetch generate the multipart boundary
  if (options.data instanceof FormData) {
    delete headers['Content-Type'];
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data !== undefined) {
    if (
      options.data instanceof FormData ||
      options.data instanceof Blob ||
      options.data instanceof ArrayBuffer
    ) {
      config.body = options.data;
    } else {
      config.body = JSON.stringify(options.data);
    }
  }

  try {
    const response = await fetch(url, config);
    const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;

    if (!response.ok) {
      /* A validation failure always carries the generic message "Validation
         failed", so listing the fields is the only way the caller learns what
         was actually wrong. */
      const fieldErrors = fieldErrorsFrom(json.errors);
      const fieldSummary = Object.entries(fieldErrors)
        .map(([field, message]) => `${field}: ${message}`)
        .join(', ');

      const errorMessage =
        fieldSummary ||
        json.message ||
        json.error ||
        `Request failed with status ${response.status}`;

      if (response.status === 401) {
        clearToken();
      }

      const error: ApiError = new Error(errorMessage);
      error.status = response.status;
      if (fieldSummary) error.fieldErrors = fieldErrors;
      throw error;
    }

    return json;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the backend service is running.');
    }
    throw error;
  }
}

export async function downloadBlob(
  endpoint: string,
  params?: Record<string, any>,
  filename = 'download.csv'
): Promise<void> {
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Export download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

export const client = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'POST', data }),

  put: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'PUT', data }),

  patch: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'PATCH', data }),

  delete: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),

  downloadBlob: (endpoint: string, params?: Record<string, any>, filename = 'download.csv') =>
    downloadBlob(endpoint, params, filename),
};
