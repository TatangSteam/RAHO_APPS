'use client';

import { useEffect, useState, useMemo } from 'react';
import type { MemberPackage, PackageDisplay, StandaloneAddOn } from '@/types/package';
import PackageCard from './PackageCard';
import styles from './MemberPackagesTab.module.css';

interface Props {
  packages: PackageDisplay[];
  loading: boolean;
  hideGroupedAddOns?: boolean;
  onVerifyPayment?: (packageId: string, packageStatus: string, proofUrl?: string, proofFileName?: string) => void;
  onRefundPackage?: (packageId: string, packageCode: string, finalPrice: number) => void;
  onCancelPackage?: (packageId: string, packageCode: string) => void;
  onEditPackage?: (purchaseGroupId: string, packages: MemberPackage[], addOns: StandaloneAddOn[], discount: number, discountPercent: number, discountNote: string, notes: string) => void;
  canEditWaitingVerification?: boolean;
  canEditVerified?: boolean;
  onViewRefundDetail?: (refundData: {
    packageCode: string;
    refundAmount: number;
    refundReason: string;
    refundedBy?: string;
    refundedAt?: string;
    refundProofUrl?: string;
    refundProofFileName?: string;
  }) => void;
}

const ITEMS_PER_PAGE = 5;

export default function MemberPackagesTab({
  packages,
  loading,
  hideGroupedAddOns = false,
  onVerifyPayment,
  onRefundPackage,
  onCancelPackage,
  onEditPackage,
  canEditWaitingVerification = false,
  canEditVerified = false,
  onViewRefundDetail,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(packages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPackages = useMemo(() => 
    packages.slice(startIndex, endIndex),
    [packages, startIndex, endIndex]
  );

  // Reset to page 1 when packages change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.loadingText}>Loading packages...</div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📦</div>
        <div className={styles.emptyTitle}>Belum ada paket</div>
        <div className={styles.emptyDescription}>
          Member belum memiliki paket terapi
        </div>
      </div>
    );
  }

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div>
      <div className={styles.packagesGrid}>
        {currentPackages.map((pkg) => {
          const key = 'isGroup' in pkg && pkg.isGroup 
            ? pkg.purchaseGroupId 
            : ('packageId' in pkg ? pkg.packageId : pkg.addOnId);
          return (
            <PackageCard
              key={key}
              pkg={pkg}
              hideGroupedAddOns={hideGroupedAddOns}
              onVerifyPayment={onVerifyPayment}
              onRefundPackage={onRefundPackage}
              onCancelPackage={onCancelPackage}
              onEditPackage={onEditPackage}
              canEditWaitingVerification={canEditWaitingVerification}
              canEditVerified={canEditVerified}
              onViewRefundDetail={onViewRefundDetail}
            />
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            ← Previous
          </button>

          <div className={styles.paginationPages}>
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={page}
                  onClick={() => handlePageClick(page as number)}
                  className={`${styles.paginationPage} ${
                    currentPage === page ? styles.paginationPageActive : ''
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next →
          </button>
        </div>
      )}

      {/* Pagination Info */}
      {packages.length > 0 && (
        <div className={styles.paginationInfo}>
          Showing {startIndex + 1}-{Math.min(endIndex, packages.length)} of {packages.length} packages
        </div>
      )}
    </div>
  );
}
