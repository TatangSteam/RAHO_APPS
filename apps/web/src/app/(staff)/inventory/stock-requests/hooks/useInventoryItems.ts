import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InventoryItem } from '../types';
import { showToast } from '@/lib/toast';

export function useInventoryItems(accessToken: string | null) {
  const router = useRouter();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const fetchInventoryItems = async () => {
    try {
      console.log('🔍 Fetching inventory items from:', `${process.env.NEXT_PUBLIC_API_URL}/inventory/items`);
      console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/items`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Inventory items response status:', response.status);
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
      console.log('✅ Inventory items loaded:', data.data?.length || 0, 'items');
      
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid data format:', data);
        throw new Error('Format data tidak valid');
      }
      
      setInventoryItems(data.data);
    } catch (error: any) {
      console.error('❌ Inventory items fetch error:', error);
      showToast.error(error.message || 'Gagal memuat data inventori');
    }
  };

  return {
    inventoryItems,
    fetchInventoryItems
  };
}