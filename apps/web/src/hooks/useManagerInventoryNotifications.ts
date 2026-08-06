'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyManagerNotificationCounts,
  fetchManagerInventoryNotifications,
  type ManagerInventoryNotifications,
} from '@/lib/api/managerNotificationsApi';
import { devError } from '@/lib/logger';

const emptyNotifications: ManagerInventoryNotifications = {
  counts: emptyManagerNotificationCounts,
  items: [],
};

interface UseManagerInventoryNotificationsOptions {
  pollMs?: number;
}

export function useManagerInventoryNotifications(
  enabled: boolean,
  options: UseManagerInventoryNotificationsOptions = {},
) {
  const { pollMs } = options;
  const [data, setData] = useState<ManagerInventoryNotifications>(emptyNotifications);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const refresh = useCallback((): Promise<void> => {
    if (!enabled) {
      setData(emptyNotifications);
      setLoading(false);
      setError(null);
      return Promise.resolve();
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const request = (async () => {
      try {
        setLoading(true);
        const notifications = await fetchManagerInventoryNotifications();
        if (!enabledRef.current) return;
        setData(notifications);
        setError(null);
      } catch (err) {
      assertCaughtError(err);
        if (!enabledRef.current) return;
        devError('Failed to fetch manager inventory notifications:', err);
        setError('Gagal memuat notifikasi inventori');
        setData(emptyNotifications);
      } finally {
        setLoading(false);
      }
    })();
    inFlightRef.current = request.finally(() => {
      inFlightRef.current = null;
    });
    return inFlightRef.current;
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !pollMs) return undefined;

    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    const intervalId = window.setInterval(pollWhenVisible, pollMs);
    document.addEventListener('visibilitychange', pollWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', pollWhenVisible);
    };
  }, [enabled, pollMs, refresh]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
}
