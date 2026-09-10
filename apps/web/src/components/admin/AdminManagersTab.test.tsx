import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminManagersTab } from './AdminManagersTab';
import { adminManagersApi, AdminManager } from '@/lib/api/adminManagersApi';
import { showToast } from '@/lib/toast';

// ── Mocks ─────────────────────────────────────────────────────

const mockRouterPush = jest.fn();

jest.mock('@/lib/api/adminManagersApi');
jest.mock('@/lib/toast');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon">Search</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  ChevronLeft: () => <div data-testid="chevron-left-icon">ChevronLeft</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Building2: () => <div data-testid="building-icon">Building2</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  BadgeDollarSign: () => <div data-testid="finance-icon">Finance</div>,
  Loader2: () => <div data-testid="loader-icon">Loading</div>,
}));

// ── Test Data ─────────────────────────────────────────────────

const mockManagers: AdminManager[] = [
  {
    id: 'manager-1',
    email: 'manager1@raho.id',
    fullName: 'Manager One',
    phoneNumber: '081234567890',
    isActive: true,
    branches: [
      { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT', type: 'CABANG', isActive: true },
      { id: 'branch-2', name: 'Bandung', branchCode: 'BDG', type: 'CABANG', isActive: true },
    ],
    createdAt: '2024-01-15T10:00:00Z',
    lastLoginAt: '2024-05-10T14:30:00Z',
  },
  {
    id: 'manager-2',
    email: 'manager2@raho.id',
    fullName: 'Manager Two',
    phoneNumber: '081234567891',
    isActive: true,
    branches: [
      { id: 'branch-3', name: 'Surabaya', branchCode: 'SBY', type: 'CABANG', isActive: true },
    ],
    createdAt: '2024-02-20T11:00:00Z',
    lastLoginAt: null,
  },
  {
    id: 'manager-3',
    email: 'manager3@raho.id',
    fullName: 'Manager Three',
    phoneNumber: '081234567892',
    isActive: false,
    branches: [],
    createdAt: '2024-03-10T09:00:00Z',
    lastLoginAt: '2024-04-01T08:00:00Z',
  },
];

const mockPaginationMeta = {
  total: 3,
  page: 1,
  limit: 10,
  totalPages: 1,
};

// ── Setup & Teardown ──────────────────────────────────────────

describe('AdminManagersTab', () => {
  const mockGetAdminManagers = adminManagersApi.getAdminManagers as jest.MockedFunction<
    typeof adminManagersApi.getAdminManagers
  >;
  const mockShowToastError = showToast.error as jest.MockedFunction<typeof showToast.error>;
  const mockShowToastSuccess = showToast.success as jest.MockedFunction<typeof showToast.success>;
  const mockConvertAdminManagerRole = adminManagersApi.convertAdminManagerRole as jest.MockedFunction<
    typeof adminManagersApi.convertAdminManagerRole
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockGetAdminManagers.mockResolvedValue({
      data: mockManagers,
      meta: mockPaginationMeta,
    });
    mockConvertAdminManagerRole.mockResolvedValue({
      data: {
        id: 'manager-1',
        email: 'manager1@raho.id',
        role: 'FINANCE_LOGISTICS_CONTROLLER',
        assignedBranchCount: 3,
        historyPreserved: true,
        roleTemplate: null,
      },
    });
  });

  // ── 1. Table Rendering Tests ────────────────────────────────

  describe('Table Rendering', () => {
    it('should render table with correct columns', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Nama')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Branches')).toBeInTheDocument();
        expect(screen.getByText('Dibuat')).toBeInTheDocument();
        expect(screen.getByText('Login Terakhir')).toBeInTheDocument();
        expect(screen.getByText('Aksi')).toBeInTheDocument();
      });
    });

    it('should render all admin managers in the table', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
        expect(screen.getByText('manager1@raho.id')).toBeInTheDocument();
        expect(screen.getByText('Manager Two')).toBeInTheDocument();
        expect(screen.getByText('manager2@raho.id')).toBeInTheDocument();
        expect(screen.getByText('Manager Three')).toBeInTheDocument();
        expect(screen.getByText('manager3@raho.id')).toBeInTheDocument();
      });
    });

    it('should display active status badge correctly', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      }, { timeout: 3000 });

      const statusBadges = screen.getAllByText('Aktif');
      // Should have 2 active managers + 1 in the filter dropdown = 3 total
      expect(statusBadges.length).toBeGreaterThanOrEqual(2);
    });

    it('should display inactive status badge correctly', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager Three')).toBeInTheDocument();
      }, { timeout: 3000 });

      const inactiveStatuses = screen.getAllByText('Tidak Aktif');
      // Should have 1 inactive manager + 1 in the filter dropdown = 2 total
      expect(inactiveStatuses.length).toBeGreaterThanOrEqual(1);
    });

    it('should display branch count correctly', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('2 branches')).toBeInTheDocument();
        expect(screen.getByText('1 branch')).toBeInTheDocument();
        expect(screen.getByText('Tidak ada branch')).toBeInTheDocument();
      });
    });

    it('should display formatted dates correctly', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        // Check that dates are rendered (format may vary based on locale)
        expect(screen.getByText(/15 Jan 2024|Jan 15, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/20 Feb 2024|Feb 20, 2024/i)).toBeInTheDocument();
      });
    });

    it('should display "-" for null lastLoginAt', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const manager2Row = rows.find(row => row.textContent?.includes('Manager Two'));
        expect(manager2Row).toHaveTextContent('-');
      });
    });

    it('should render avatar with first letter of name', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      // All three managers have names starting with 'M', so there should be 3 avatars with 'M'
      const avatars = screen.getAllByText('M');
      expect(avatars.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── 2. Loading State Tests ──────────────────────────────────

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      render(<AdminManagersTab />);

      expect(screen.getByText('Memuat data Admin Manager...')).toBeInTheDocument();
      expect(screen.getByText('⏳')).toBeInTheDocument();
    });

    it('should hide loading state after data is loaded', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.queryByText('Memuat data Admin Manager...')).not.toBeInTheDocument();
      });
    });
  });

  // ── 3. Empty State Tests ────────────────────────────────────

  describe('Empty State', () => {
    it('should show empty state when no managers exist', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Belum Ada Admin Manager')).toBeInTheDocument();
        expect(screen.getByText('Mulai dengan menambahkan Admin Manager pertama Anda.')).toBeInTheDocument();
      });
    });

    it('should show only one add button when empty', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        const addButtons = screen.getAllByText('Tambah Admin Manager');
        expect(addButtons).toHaveLength(1);
      });
    });
  });

  // ── 4. Error State Tests ────────────────────────────────────

  describe('Error Handling', () => {
    it('should show error toast when API call fails', async () => {
      const errorMessage = 'Network error';
      mockGetAdminManagers.mockRejectedValue({
        response: { data: { message: errorMessage } },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(mockShowToastError).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should show default error message when no error message provided', async () => {
      mockGetAdminManagers.mockRejectedValue(new Error());

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(mockShowToastError).toHaveBeenCalledWith('Gagal memuat data Admin Manager');
      });
    });

    it('should set managers to empty array on error', async () => {
      mockGetAdminManagers.mockRejectedValue(new Error('API Error'));

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Belum Ada Admin Manager')).toBeInTheDocument();
      });
    });
  });

  // ── 5. Search Functionality Tests ───────────────────────────

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should call API with search parameter when searching', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
      fireEvent.change(searchInput, { target: { value: 'Manager One' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Manager One',
            page: 1,
          })
        );
      });
    });

    it('should reset to page 1 when searching', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
          })
        );
      });
    });
  });

  // ── 6. Filter Functionality Tests ───────────────────────────

  describe('Filter Functionality', () => {
    it('should render status filter dropdown', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const filterSelect = screen.getByDisplayValue('Semua Status');
        expect(filterSelect).toBeInTheDocument();
      });
    });

    it('should have all filter options', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Semua Status')).toBeInTheDocument();
        expect(screen.getByText('Aktif')).toBeInTheDocument();
        expect(screen.getByText('Tidak Aktif')).toBeInTheDocument();
      });
    });

    it('should call API with status filter when changed', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue('Semua Status');
      fireEvent.change(filterSelect, { target: { value: 'active' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: true,
            page: 1,
          })
        );
      });
    });

    it('should reset to page 1 when filter changes', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue('Semua Status');
      fireEvent.change(filterSelect, { target: { value: 'inactive' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
          })
        );
      });
    });
  });

  // ── 7. Pagination Tests ─────────────────────────────────────

  describe('Pagination', () => {
    it('should not show pagination when only one page', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
      });
    });

    it('should show pagination when multiple pages exist', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      });
    });

    it('should disable Previous button on first page', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        const prevButton = screen.getByText('Previous').closest('button');
        expect(prevButton).toBeDisabled();
      });
    });

    it('should enable Next button when not on last page', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        const nextButton = screen.getByText('Next').closest('button');
        expect(nextButton).not.toBeDisabled();
      });
    });

    it('should call API with correct page when Next is clicked', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next').closest('button');
      fireEvent.click(nextButton!);

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
          })
        );
      });
    });

    it('should call API with correct page when Previous is clicked', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('Previous').closest('button');
      fireEvent.click(prevButton!);

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
          })
        );
      });
    });
  });

  // ── 8. Stats Cards Tests ────────────────────────────────────

  describe('Stats Cards', () => {
    it('should display total admin managers count', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Total Admin Manager')).toBeInTheDocument();
        const totalStatCard = screen.getByText('Total Admin Manager').closest('.statCard');
        expect(totalStatCard).toHaveTextContent('3');
      });
    });

    it('should display active admin managers count', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Admin Manager Aktif')).toBeInTheDocument();
        const activeStatCard = screen.getByText('Admin Manager Aktif').closest('.statCard');
        expect(activeStatCard).toHaveTextContent('2');
      });
    });

    it('should display total branches assigned', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Total Branches Assigned')).toBeInTheDocument();
        const branchesStatCard = screen.getByText('Total Branches Assigned').closest('.statCard');
        expect(branchesStatCard).toHaveTextContent('3'); // 2 + 1 + 0 = 3
      });
    });

    it('should update stats when data changes', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const totalStatCard = screen.getByText('Total Admin Manager').closest('.statCard');
        expect(totalStatCard).toHaveTextContent('3');
      });

      // Clear and update mock data for next render
      mockGetAdminManagers.mockClear();
      mockGetAdminManagers.mockResolvedValue({
        data: [mockManagers[0]],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      // Trigger a re-fetch by changing search
      const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
      fireEvent.change(searchInput, { target: { value: 'Manager One' } });

      await waitFor(() => {
        const totalStatCard = screen.getByText('Total Admin Manager').closest('.statCard');
        expect(totalStatCard).toHaveTextContent('1');
      });
    });
  });

  // ── 9. Action Buttons Tests ─────────────────────────────────

  describe('Action Buttons', () => {
    it('should render detail button for each manager', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const detailButtons = screen.getAllByText('Detail');
        expect(detailButtons).toHaveLength(3);
      });
    });

    it('should use detail action title for each manager', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const detailButtons = screen.getAllByTitle('Lihat Detail & Kelola');
        expect(detailButtons).toHaveLength(3);
      });
    });

    it('should navigate to manager detail when detail is clicked', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Detail')[0]);

      expect(mockRouterPush).toHaveBeenCalledWith('/admin/managers/manager-1');
    });
  });

  // ── 10. Header Tests ────────────────────────────────────────

  describe('Header', () => {
    it('should render header title', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Admin Managers')).toBeInTheDocument();
      });
    });

    it('should render header description', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Kelola dan monitor Admin Manager di sistem')).toBeInTheDocument();
      });
    });

    it('should render add button in header', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        const addButtons = screen.getAllByText('Tambah Admin Manager');
        expect(addButtons.length).toBeGreaterThan(0);
      });
    });
  });

  // ── 11. Integration with Detail Navigation ───────────────

  describe('Integration with detail navigation', () => {
    it('should render detail actions for loaded managers', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const detailButtons = screen.getAllByText('Detail');
      expect(detailButtons).toHaveLength(3);
    });

    it('should navigate to the selected manager detail page', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager Two')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Detail')[1]);

      expect(mockRouterPush).toHaveBeenCalledWith('/admin/managers/manager-2');
    });
  });

  // ── 12. API Call Tests ──────────────────────────────────────

  describe('API Calls', () => {
    it('should call getAdminManagers on mount', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
        });
      });
    });

    it('should call getAdminManagers when page changes', async () => {
      mockGetAdminManagers.mockResolvedValue({
        data: mockManagers,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      });

      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next').closest('button');
      fireEvent.click(nextButton!);

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledTimes(2);
      });
    });

    it('should call getAdminManagers when search changes', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledTimes(2);
      });
    });

    it('should call getAdminManagers when filter changes', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue('Semua Status');
      fireEvent.change(filterSelect, { target: { value: 'active' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ── 13. Branch Display Tests ────────────────────────────────

  describe('Branch Display', () => {
    it('should display branch count with icon', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('2 branches')).toBeInTheDocument();
      });
    });

    it('should show singular "branch" for single branch', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('1 branch')).toBeInTheDocument();
      });
    });

    it('should show "Tidak ada branch" when no branches', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Tidak ada branch')).toBeInTheDocument();
      });
    });
  });

  // ── 14. Combined Filter and Search Tests ────────────────────

  describe('Combined Filter and Search', () => {
    it('should apply both search and filter parameters', async () => {
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      // Apply search
      const searchInput = screen.getByPlaceholderText('Cari Admin Manager...');
      fireEvent.change(searchInput, { target: { value: 'Manager' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Manager',
          })
        );
      });

      // Apply filter
      const filterSelect = screen.getByDisplayValue('Semua Status');
      fireEvent.change(filterSelect, { target: { value: 'active' } });

      await waitFor(() => {
        expect(mockGetAdminManagers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Manager',
            isActive: true,
          })
        );
      });
    });
  });

  describe('Finance and Logistics assignment', () => {
    it('lets Super Admin convert an active manager directly from the list', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      render(<AdminManagersTab />);

      await waitFor(() => {
        expect(screen.getByText('Manager One')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Set Finance & Logistik untuk Manager One' }));

      await waitFor(() => {
        expect(mockConvertAdminManagerRole).toHaveBeenCalledWith(
          'manager-1',
          'FINANCE_LOGISTICS_CONTROLLER',
        );
      });
      expect(mockShowToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('berhasil ditetapkan sebagai Finance & Logistik'),
      );
      confirmSpy.mockRestore();
    });
  });
});
