import { API_ORIGIN } from './client';

/**
 * The backend's own health report.
 *
 * Served outside `/api/v1` and without auth, because something has to be
 * answerable when the token is the thing that is broken.
 */
export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  database: string;
  timestamp: string;
  uptime: number;
}

export const systemService = {
  async health(): Promise<SystemHealth> {
    const res = await fetch(`${API_ORIGIN}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return (await res.json()) as SystemHealth;
  },
};

export default systemService;
