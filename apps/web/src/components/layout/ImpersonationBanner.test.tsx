import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImpersonationBanner } from './ImpersonationBanner';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { showToast } from '@/lib/toast';

// ── Mocks ─────────────────────────────────────────────────────

jest.mock('@/contexts/ImpersonationContext');
jest.mock('@/lib/toast');

// ── Test Data ─────────────────────────────────────────────────

const mockImpersonationChain = [
  {
    userId: 'super-admin-id',
    email: 'superadmin@raho.id',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN' as const,
  },
  {
    userId: 'manager-id',
    email: 'manager@raho.id',
    fullName: 'Manager Name',
    role: 'ADMIN_MANAGER' as const,
  },
];

const mockNestedImpersonationChain = [
  {
    userId: 'super-admin-id',
    email: 'superadmin@raho.id',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN' as const,
  },
  {
    userId: 'manager-id',
    email: 'manager@raho.id',
    fullName: 'Manager Name',
    role: 'ADMIN_MANAGER' as const,
  },
  {
    userId: 'admin-cabang-id',
    email: 'admincabang@raho.id',
    fullName: 'Admin Cabang',
    role: 'ADMIN_CABANG' as const,
  },
];

// ── Setup & Teardown ──────────────────────────────────────────

describe('ImpersonationBanner', () => {
  const mockUseImpersonation = useImpersonation as jest.MockedFunction<typeof useImpersonation>;
  const mockShowToastError = showToast.error as jest.MockedFunction<typeof showToast.error>;
  const mockStopImpersonation = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Banner Visibility Tests ──────────────────────────────

  describe('Banner Visibility', () => {
    it('should NOT show banner when not impersonating', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: false,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: [],
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      const { container } = render(<ImpersonationBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should NOT show banner when isImpersonating is true but chain length < 2', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: [mockImpersonationChain[0]], // Only 1 item
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      const { container } = render(<ImpersonationBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should show banner when isImpersonating is true AND chain length >= 2', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('Anda sedang masuk sebagai:')).toBeInTheDocument();
    });

    it('should show banner when chain length is exactly 2', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('Anda sedang masuk sebagai:')).toBeInTheDocument();
    });

    it('should show banner when chain length is greater than 2 (nested impersonation)', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockNestedImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('Anda sedang masuk sebagai:')).toBeInTheDocument();
    });
  });

  // ── 2. Banner Content Tests ─────────────────────────────────

  describe('Banner Content', () => {
    it('should display impersonation chain correctly', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText(/Super Admin \(Super Admin\) → Admin Manager \(Manager Name\)/)).toBeInTheDocument();
    });

    it('should display nested impersonation chain correctly', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockNestedImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText(/Super Admin \(Super Admin\) → Admin Manager \(Manager Name\) → Admin Cabang \(Admin Cabang\)/)).toBeInTheDocument();
    });

    it('should display user icon', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('👤')).toBeInTheDocument();
    });

    it('should display "Kembali ke Super Admin" button when impersonating as Admin Manager', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('← Kembali ke Super Admin')).toBeInTheDocument();
    });

    it('should display "Kembali ke Admin Manager" button when nested impersonation', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockNestedImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('← Kembali ke Admin Manager')).toBeInTheDocument();
    });
  });

  // ── 3. Stop Impersonation Tests ─────────────────────────────

  describe('Stop Impersonation', () => {
    it('should call stopImpersonation when exit button is clicked', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      const exitButton = screen.getByText('← Kembali ke Super Admin');
      fireEvent.click(exitButton);

      expect(mockStopImpersonation).toHaveBeenCalledTimes(1);
    });

    it('should not call stopImpersonation when loading', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: true,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      const exitButton = screen.getByText('Memproses...');
      fireEvent.click(exitButton);

      expect(mockStopImpersonation).not.toHaveBeenCalled();
    });

    it('should disable exit button when loading', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: true,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      const exitButton = screen.getByText('Memproses...').closest('button');
      expect(exitButton).toBeDisabled();
    });

    it('should show "Memproses..." text when loading', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: true,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText('Memproses...')).toBeInTheDocument();
    });
  });

  // ── 4. Error Handling Tests ─────────────────────────────────

  describe('Error Handling', () => {
    it('should show error toast when error occurs', async () => {
      const errorMessage = 'Failed to stop impersonation';
      
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: errorMessage,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      await waitFor(() => {
        expect(mockShowToastError).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should clear error after showing toast', async () => {
      jest.useFakeTimers();

      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: 'Some error',
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      await waitFor(() => {
        expect(mockShowToastError).toHaveBeenCalled();
      });

      // Fast-forward timer
      jest.advanceTimersByTime(100);

      expect(mockClearError).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should not show toast when no error', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: mockImpersonationChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(mockShowToastError).not.toHaveBeenCalled();
    });
  });

  // ── 5. Role Display Tests ───────────────────────────────────

  describe('Role Display', () => {
    it('should display role names correctly for all roles', () => {
      const chainWithAllRoles = [
        { userId: '1', email: 'super@raho.id', fullName: 'Super', role: 'SUPER_ADMIN' as const },
        { userId: '2', email: 'manager@raho.id', fullName: 'Manager', role: 'ADMIN_MANAGER' as const },
      ];

      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: chainWithAllRoles,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText(/Super Admin \(Super\)/)).toBeInTheDocument();
      expect(screen.getByText(/Admin Manager \(Manager\)/)).toBeInTheDocument();
    });

    it('should display Admin Cabang role correctly', () => {
      const chainWithAdminCabang = [
        { userId: '1', email: 'manager@raho.id', fullName: 'Manager', role: 'ADMIN_MANAGER' as const },
        { userId: '2', email: 'cabang@raho.id', fullName: 'Cabang', role: 'ADMIN_CABANG' as const },
      ];

      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: chainWithAdminCabang,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText(/Admin Cabang \(Cabang\)/)).toBeInTheDocument();
    });

    it('should display other roles correctly', () => {
      const chainWithOtherRoles = [
        { userId: '1', email: 'admin@raho.id', fullName: 'Admin', role: 'ADMIN_LAYANAN' as const },
        { userId: '2', email: 'doctor@raho.id', fullName: 'Doctor', role: 'DOCTOR' as const },
      ];

      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: chainWithOtherRoles,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      expect(screen.getByText(/Admin Layanan \(Admin\)/)).toBeInTheDocument();
      expect(screen.getByText(/Doctor \(Doctor\)/)).toBeInTheDocument();
    });
  });

  // ── 6. Edge Cases Tests ─────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty chain gracefully', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: [],
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      const { container } = render(<ImpersonationBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle chain with only one user', () => {
      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: [mockImpersonationChain[0]],
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      const { container } = render(<ImpersonationBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle very long chain (more than 3 levels)', () => {
      const longChain = [
        { userId: '1', email: 'user1@raho.id', fullName: 'User 1', role: 'SUPER_ADMIN' as const },
        { userId: '2', email: 'user2@raho.id', fullName: 'User 2', role: 'ADMIN_MANAGER' as const },
        { userId: '3', email: 'user3@raho.id', fullName: 'User 3', role: 'ADMIN_CABANG' as const },
        { userId: '4', email: 'user4@raho.id', fullName: 'User 4', role: 'DOCTOR' as const },
      ];

      mockUseImpersonation.mockReturnValue({
        isImpersonating: true,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: longChain,
        loading: false,
        error: null,
        startImpersonation: jest.fn(),
        stopImpersonation: mockStopImpersonation,
        clearError: mockClearError,
      });

      render(<ImpersonationBanner />);

      // Should display all users in the chain
      expect(screen.getByText(/User 1.*User 2.*User 3.*User 4/)).toBeInTheDocument();
    });
  });
});
