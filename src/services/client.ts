import { ApiResponse } from '../types/auth.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api/v1';
export const TOKEN_KEY = 'perfox_auth_token';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string, rememberMe = true): void => {
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export interface RequestOptions extends RequestInit {
  data?: any;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
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

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data !== undefined) {
    config.body = JSON.stringify(options.data);
  }

  try {
    const response = await fetch(url, config);
    const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;

    if (!response.ok) {
      const errorMessage =
        json.message ||
        json.error ||
        (Array.isArray(json.errors) ? json.errors.join(', ') : null) ||
        `Request failed with status ${response.status}`;

      if (response.status === 401) {
        clearToken();
      }

      throw new Error(errorMessage);
    }

    return json;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the backend service is running.');
    }
    throw error;
  }
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
};
