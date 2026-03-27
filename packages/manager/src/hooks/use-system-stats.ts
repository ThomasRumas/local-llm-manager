import { useState, useEffect } from 'react';
import {
  systemStatsService,
  type SystemStats,
} from '../modules/system/system-stats.service.js';

export { type SystemStats };

export function useSystemStats(
  pid: number | null = null,
  intervalMs = 3000,
): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      systemStatsService
        .getSnapshot(pid)
        .then((s) => {
          if (!cancelled) setStats(s);
        })
        .catch(() => {});
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pid, intervalMs]);

  return stats;
}
