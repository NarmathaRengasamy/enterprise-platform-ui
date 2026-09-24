/* Single HTTP entry point for the Perfox backend.

   The backend wraps every payload in an envelope — `{ success, data }` for a single
   resource and `{ success, total, page, limit, totalPages, data }` for a list. Callers
   here only ever see `data`; `requestList` hands back the pagination fields alongside it. */

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5051/api/v1';

const TOKEN_KEY = 'omniflow.token';

export class ApiError extends Error {
  status: number;
  /* Zod field errors, when the backend rejected the body */
  fieldErrors: Array<{ path: string; message: string }>;

  constructor(message: string, status: number, fieldErrors: Array<{ path: string; message: string }> = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private-mode browsers block storage; the session just won't survive a reload */
  }
};

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListResult<T> extends ListMeta {
  data: T[];
}

/* Drops empty values so `?search=` never goes out on an untouched search box. */
export const toQuery = (params: Record<string, unknown> = {}): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /* FormData uploads must not get a JSON content-type */
  raw?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, raw, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    ...(raw ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((headers as Record<string, string>) || {})
  };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body)
    });
  } catch {
    /* fetch only rejects on a network-level failure, so this is "server unreachable" */
    throw new ApiError(
      `Cannot reach the API at ${BASE_URL}. Is the backend running?`,
      0
    );
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) setToken(null);
    throw new ApiError(
      payload?.message || `Request failed (${response.status})`,
      response.status,
      payload?.errors || []
    );
  }

  return payload as T;
}

/* Unwraps `{ success, data }` → `data`. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await request<{ data: T }>(path, { method: 'GET' });
  return res?.data as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await request<{ data: T }>(path, { method: 'POST', body });
  return res?.data as T;
}

/**
 * Uploads a file as a raw byte stream.
 *
 * The browser sends the bytes with `application/octet-stream` and passes the
 * name and real media type as query parameters; the server rebuilds the
 * multipart request for Perfox and supplies the target folder itself. Sending
 * multipart from here would let the caller choose the folder, and would need a
 * multipart parser on the server for no gain.
 */
export async function apiUpload<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<T> {
  const token = getToken();
  const query = `name=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(
    file.type || 'application/octet-stream'
  )}`;
  const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}${query}`;

  /* XMLHttpRequest rather than fetch: it reports upload progress, which matters
     for a document that takes a moment to go up. */
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    xhr.onload = () => {
      let payload: any = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* A non-JSON body means the failure happened before our handler ran. */
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload?.data as T);
        return;
      }
      if (xhr.status === 401) setToken(null);
      reject(
        new ApiError(
          payload?.message || `Upload failed (${xhr.status})`,
          xhr.status,
          payload?.errors ?? []
        )
      );
    };

    xhr.onerror = () => reject(new ApiError('Could not reach the server.', 0));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0));
    xhr.send(file);
  });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await request<{ data: T }>(path, { method: 'PUT', body });
  return res?.data as T;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await request<{ data: T }>(path, { method: 'PATCH', body });
  return res?.data as T;
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await request<{ data: T }>(path, { method: 'DELETE' });
  return res?.data as T;
}

/* Keeps the pagination metadata. Endpoints that don't paginate yet return
   `{ success, total, data }`, so page/limit/totalPages are defaulted from the row count. */
/**
 * Returns the whole envelope minus `success`, for responses that carry fields
 * beyond the standard list shape — the conversations list reports which source
 * it came from, and `apiGetList` would drop that.
 */
export async function apiGetRaw<T>(path: string): Promise<T> {
  const res = await request<any>(path, { method: 'GET' });
  const { success, ...rest } = res ?? {};
  return rest as T;
}

export async function apiGetList<T>(path: string): Promise<ListResult<T>> {
  const res = await request<{ data: T[]; total?: number; page?: number; limit?: number; totalPages?: number }>(
    path,
    { method: 'GET' }
  );
  const rows = res?.data || [];
  return {
    data: rows,
    total: res?.total ?? rows.length,
    page: res?.page ?? 1,
    limit: res?.limit ?? rows.length,
    totalPages: res?.totalPages ?? 1
  };
}

export const API_BASE_URL = BASE_URL;
