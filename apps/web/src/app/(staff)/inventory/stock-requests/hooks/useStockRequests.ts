import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StockRequest, FilterType } from '../types';
import { showToast } from '@/lib/toast';

export function useStockRequests(accessToken: string | null, filter: FilterType) {
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
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

      console.log('🔍 Fetching stock requests with filter:', filter);
      const url = `${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests?${params}`;
      console.log('URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Stock requests response status:', response.status);
      console.log('Response OK:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Stock requests loaded:', data.data?.length || 0, 'requests');
      
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid data format:', data);
        throw new Error('Format data tidak valid');
      }
      
      setRequests(data.data);
    } catch (error: any) {
      console.error('❌ Stock requests fetch error:', error);
      showToast.error(error.message || 'Gagal memuat request stok');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchRequests();
    }
  }, [accessToken, filter]);

  return {
    requests,
    loading,
    refetch: fetchRequests
  };
}