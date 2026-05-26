'use client';

import { BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

interface RevenueChartProps {
  data: Array<{
    date: string;
    amount: number;
  }>;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
        <p className="text-neutral-500">Tidak ada data untuk ditampilkan</p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount));
  const minAmount = Math.min(...data.map(d => d.amount));
  const range = maxAmount - minAmount || 1;

  return (
    <div>
      <div className="flex items-end gap-1 h-48 md:h-64">
        {data.map((item, index) => {
          const height = ((item.amount - minAmount) / range) * 100;
          const date = new Date(item.date);
          const day = date.getDate();
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full h-full flex items-end justify-center">
                <div 
                  className="w-full max-w-[32px] bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md hover:from-blue-600 hover:to-blue-500 transition-all cursor-pointer group relative"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${day}: ${formatCurrency(item.amount)}`}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{day}</span>
            </div>
          );
        })}
      </div>
      <div className="text-center mt-4">
        <span className="text-xs text-neutral-400">Tanggal</span>
      </div>
    </div>
  );
}
