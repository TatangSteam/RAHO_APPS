'use client';

import { ToastContainer } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function ToastProvider() {
  return (
    <>
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}
