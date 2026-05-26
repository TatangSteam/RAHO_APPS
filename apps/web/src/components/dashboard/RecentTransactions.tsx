'use client';

import Link from 'next/link';
import { Receipt, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

interface Transaction {
  invoiceNumber: string;
  memberNo: string;
  memberName: string;
  amount: number;
  paidAt: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
        <p className="text-neutral-500">Belum ada transaksi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction, index) => (
        <div 
          key={index} 
          className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Receipt className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-neutral-900 dark:text-white truncate">
                {transaction.memberName}
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>{transaction.memberNo}</span>
              <span>•</span>
              <span>{transaction.invoiceNumber}</span>
              <span>•</span>
              <span>{formatDate(transaction.paidAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
