import { useEffect, useState } from 'react';
import systemService, { SystemHealth } from '../services/system.service';

/**
 * Whether the backend is actually up, for the sidebar footer.
 *
 * That footer used to say "Systems Active" and "v2.4.0" as plain text, which
 * meant it claimed the system was healthy while the server was down and
 * reported a version number nobody had updated since it was typed. Both now
 * come from the service itself.
 *
 * Polls rather than checking once: the footer is on screen the whole session,
 * and a status that was true at login is not a status.
 */
export interface SystemStatus {
  online: boolean;
  /** True only while the very first check is in flight. */
  checking: boolean;
  version?: string;
  detail: string;
}

const POLL_MS = 60_000;

export const useSystemHealth = (): SystemStatus => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const next = await systemService.health();
        if (cancelled) return;
        setHealth(next);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const dbDown = health?.database !== undefined && health.database !== 'connected';
  const online = !failed && health?.status === 'healthy' && !dbDown;

  return {
    online,
    checking,
    version: health?.version,
    detail: failed
      ? 'Cannot reach the server'
      : dbDown
        ? 'Database disconnected'
        : online
          ? 'All systems operational'
          : 'Checking…',
  };
};

export default useSystemHealth;
