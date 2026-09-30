import { API_ORIGIN } from '../services/client';

/**
 * Makes a stored media URL loadable in an `<img>` / `<video>`.
 *
 * Uploads are served from the API server's root (`/uploads/...`), not from this
 * app's origin, so a server-relative URL is resolved against the API origin.
 * Absolute and `data:` URLs pass through. A `blob:` URL is refused: it only ever
 * existed in the tab that created it, and must never be stored or shown as saved.
 */
export const resolveAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('blob:')) return undefined;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};
