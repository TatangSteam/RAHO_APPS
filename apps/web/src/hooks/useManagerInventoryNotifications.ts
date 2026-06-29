'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(emptyNotifications);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const notifications = await fetchManagerInventoryNotifications();
      setData(notifications);
      setError(null);
    } catch (err) {
      devError('Failed to fetch manager inventory notifications:', err);
      setError('Gagal memuat notifikasi inventori');
      setData(emptyNotifications);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !pollMs) return undefined;

    const intervalId = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, pollMs, refresh]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
}
