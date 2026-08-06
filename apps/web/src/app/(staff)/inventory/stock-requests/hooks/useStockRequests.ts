import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StockRequest, FilterType } from '../types';
import { showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';

export function useStockRequests(accessToken: string | null, filter: FilterType) {
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filter !== 'ALL') {
        params.append('status', filter);
      }

      devLog('🔍 Fetching stock requests with filter:', filter);
      const url = `${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests?${params}`;
      devLog('URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      devLog('Stock requests response status:', response.status);
      devLog('Response OK:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        const errorText = await response.text();
        devError('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      devLog('✅ Stock requests loaded:', data.data?.length || 0, 'requests');
      
      if (!data.data || !Array.isArray(data.data)) {
        devError('Invalid data format:', data);
        throw new Error('Format data tidak valid');
      }
      
      setRequests(data.data);
    } catch (error) {
      assertCaughtError(error);
      devError('❌ Stock requests fetch error:', error);
      showToast.error(error.message || 'Gagal memuat request stok');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, router]);

  useEffect(() => {
    if (accessToken) {
      void fetchRequests();
    }
  }, [accessToken, fetchRequests]);

  return {
    requests,
    loading,
    refetch: fetchRequests
  };
}
