'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import { inventoryApi } from '@/lib/api/inventoryApi';
import type {
  HomecareBag,
  HomecareBagRequest,
  HomecareBagShipment,
  HomecareBagStockDetail,
  HomecareBranchOption,
  HomecareProduct,
  HomecareStaffOption,
  HomecareTeam,
} from '@/lib/api/inventoryApi';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type TabKey = 'bags' | 'requests' | 'shipments' | 'movements' | 'setup';
type BagItemRow = {
  masterProductId: string;
  quantity: string;
  notes: string;
  isReusable?: boolean;
  condition?: string;
};
type OpnameRow = {
  masterProductId: string;
  physicalQty: string;
  notes: string;
};
type ApprovalRow = {
  masterProductId: string;
  approvedQty: string;
  notes: string;
};
type ReceiveRow = {
  masterProductId: string;
  expectedQty: number;
  receivedQty: string;
  notes: string;
};

const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'bags', label: 'Tas', icon: <Boxes size={16} /> },
  { key: 'requests', label: 'Request', icon: <ClipboardList size={16} /> },
  { key: 'shipments', label: 'Pengiriman', icon: <Truck size={16} /> },
  { key: 'movements', label: 'Lapangan', icon: <RotateCcw size={16} /> },
  { key: 'setup', label: 'Setup Tim', icon: <Users size={16} /> },
];

const requestStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Disetujui',
  PARTIALLY_APPROVED: 'Disetujui Sebagian',
  REJECTED: 'Ditolak',
  SHIPPED: 'Dikirim',
  RECEIVED_WITH_ISSUE: 'Diterima Bermasalah',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const shipmentStatusLabels: Record<string, string> = {
  PREPARING: 'Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Diterima Bermasalah',
};

const teamMemberRoles = [
  { value: 'ADMIN_LAYANAN', label: 'Admin Layanan' },
  { value: 'DOCTOR', label: 'Dokter' },
  { value: 'NURSE', label: 'Nakes' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'OTHER', label: 'Lainnya' },
] as const;

function unwrapData<T>(response: any, fallback: T): T {
  const payload = response?.data?.data;
  if (payload === undefined || payload === null) return fallback;
  return payload as T;
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback;
}

function statusClass(status: string) {
  if (['COMPLETED', 'RECEIVED'].includes(status)) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25';
  if (['APPROVED', 'PARTIALLY_APPROVED', 'PREPARING'].includes(status)) return 'bg-blue-500/15 text-blue-500 border-blue-500/25';
  if (['PENDING', 'SHIPPED', 'IN_CHECKING'].includes(status)) return 'bg-amber-500/15 text-amber-500 border-amber-500/25';
  if (['REJECTED', 'DAMAGED', 'LOST', 'CANCELLED', 'RECEIVED_WITH_ISSUE'].includes(status)) return 'bg-red-500/15 text-red-500 border-red-500/25';
  return 'bg-neutral-500/15 text-neutral-500 border-neutral-500/25';
}

function formatDate(date?: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomecareBagsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('bags');

  const [branches, setBranches] = useState<HomecareBranchOption[]>([]);
  const [products, setProducts] = useState<HomecareProduct[]>([]);
  const [staffOptions, setStaffOptions] = useState<HomecareStaffOption[]>([]);
  const [teams, setTeams] = useState<HomecareTeam[]>([]);
  const [bags, setBags] = useState<HomecareBag[]>([]);
  const [requests, setRequests] = useState<HomecareBagRequest[]>([]);
  const [shipments, setShipments] = useState<HomecareBagShipment[]>([]);
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagStock, setBagStock] = useState<HomecareBagStockDetail | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  const [teamForm, setTeamForm] = useState({ name: '', teamCode: '', branchId: '', description: '' });
  const [memberForm, setMemberForm] = useState({ teamId: '', userId: '', role: 'ADMIN_LAYANAN', notes: '' });
  const [bagForm, setBagForm] = useState({ name: '', bagCode: '', teamId: '', branchId: '', status: 'ACTIVE', notes: '' });

  const [requestForm, setRequestForm] = useState({ teamId: '', bagId: '', priority: 'NORMAL', requestNotes: '' });
  const [requestRows, setRequestRows] = useState<BagItemRow[]>([{ masterProductId: '', quantity: '', notes: '' }]);

  const [selectedRequest, setSelectedRequest] = useState<HomecareBagRequest | null>(null);
  const [requestAction, setRequestAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalRows, setApprovalRows] = useState<ApprovalRow[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');

  const [selectedShipment, setSelectedShipment] = useState<HomecareBagShipment | null>(null);
  const [shipmentAction, setShipmentAction] = useState<'ship' | 'receive' | null>(null);
  const [shipmentNotes, setShipmentNotes] = useState('');
  const [receiveRows, setReceiveRows] = useState<ReceiveRow[]>([]);

  const [usageRows, setUsageRows] = useState<BagItemRow[]>([{ masterProductId: '', quantity: '', notes: '' }]);
  const [usageNotes, setUsageNotes] = useState('');
  const [usageAllowNegative, setUsageAllowNegative] = useState(false);
  const [returnRows, setReturnRows] = useState<BagItemRow[]>([{ masterProductId: '', quantity: '', notes: '', isReusable: true, condition: 'BAIK' }]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnBranchId, setReturnBranchId] = useState('');
  const [returnAllowNegative, setReturnAllowNegative] = useState(false);
  const [opnameRows, setOpnameRows] = useState<OpnameRow[]>([{ masterProductId: '', physicalQty: '', notes: '' }]);
  const [opnameNotes, setOpnameNotes] = useState('');
  const [opnameCreateAdjustments, setOpnameCreateAdjustments] = useState(true);

  const role = user?.role || '';
  const canManageSetup = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'].includes(role);
  const canRequestBagStock = role === 'ADMIN_LAYANAN';
  const canReviewRequests = canManageSetup;
  const canShipStock = canManageSetup;
  const canAllowNegative = role === 'SUPER_ADMIN';

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedBag = useMemo(() => bags.find((bag) => bag.id === selectedBagId) || null, [bags, selectedBagId]);
  const selectedTeam = useMemo(() => teams.find((team) => team.id === (selectedBag?.teamId || requestForm.teamId || bagForm.teamId)), [teams, selectedBag, requestForm.teamId, bagForm.teamId]);
  const bagStockProductIds = useMemo(() => new Set((bagStock?.stocks || []).map((stock) => stock.masterProductId)), [bagStock]);
  const stockProducts = useMemo(
    () => products.filter((product) => bagStockProductIds.has(product.id)),
    [bagStockProductIds, products],
  );
  const pendingRequests = requests.filter((request) => request.status === 'PENDING');
  const preparingShipments = shipments.filter((shipment) => shipment.status === 'PREPARING');
  const shippedShipments = shipments.filter((shipment) => shipment.status === 'SHIPPED');

  const productName = useCallback(
    (masterProductId: string) => productMap.get(masterProductId)?.name || masterProductId,
    [productMap],
  );

  const productUnit = useCallback(
    (masterProductId: string) => productMap.get(masterProductId)?.baseUnit || productMap.get(masterProductId)?.usageUnit || 'unit',
    [productMap],
  );

  const loadBagStock = useCallback(async (bagId: string) => {
    if (!bagId || !accessToken) return;

    try {
      setStockLoading(true);
      const response = await inventoryApi.getHomecareBagStock(bagId);
      setBagStock(unwrapData<HomecareBagStockDetail | null>(response, null));
    } catch (error) {
      devError('Failed to load homecare bag stock:', error);
      setBagStock(null);
      showToast.error('Gagal memuat stok tas');
    } finally {
      setStockLoading(false);
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      const [branchesResponse, productsResponse, teamsResponse, bagsResponse, requestsResponse, shipmentsResponse] = await Promise.all([
        inventoryApi.getHomecareBranches(),
        inventoryApi.getHomecareProducts(),
        inventoryApi.getHomecareTeams(),
        inventoryApi.getHomecareBags(),
        inventoryApi.getHomecareBagRequests(),
        inventoryApi.getHomecareBagShipments(),
      ]);

      const branchData = unwrapData<HomecareBranchOption[]>(branchesResponse, []);
      const productPayload = unwrapData<{ products?: HomecareProduct[] }>(productsResponse, { products: [] });
      const teamData = unwrapData<HomecareTeam[]>(teamsResponse, []);
      const bagData = unwrapData<HomecareBag[]>(bagsResponse, []);

      setBranches(branchData);
      setProducts(productPayload.products || []);
      setTeams(teamData);
      setBags(bagData);
      setRequests(unwrapData<HomecareBagRequest[]>(requestsResponse, []));
      setShipments(unwrapData<HomecareBagShipment[]>(shipmentsResponse, []));

      if (!teamForm.branchId && branchData[0]) {
        setTeamForm((current) => ({ ...current, branchId: current.branchId || branchData[0].id }));
      }
      if (!returnBranchId && branchData[0]) {
        setReturnBranchId(branchData[0].id);
      }
      if (!selectedBagId && bagData[0]) {
        setSelectedBagId(bagData[0].id);
      }

      if (canManageSetup) {
        const staffResponse = await inventoryApi.getHomecareStaff();
        setStaffOptions(unwrapData<HomecareStaffOption[]>(staffResponse, []));
      }
    } catch (error) {
      devError('Failed to load homecare logistics data:', error);
      showToast.error('Gagal memuat data tas homecare');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canManageSetup, returnBranchId, selectedBagId, teamForm.branchId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    loadData();
  }, [accessToken, loadData, mounted, router, user]);

  useEffect(() => {
    if (selectedBagId) {
      loadBagStock(selectedBagId);
    }
  }, [loadBagStock, selectedBagId]);

  const resetAfterAction = async (message: string) => {
    showToast.success(message);
    await loadData();
    if (selectedBagId) await loadBagStock(selectedBagId);
  };

  const updateRow = <T extends Record<string, any>>(
    rows: T[],
    setRows: (rows: T[]) => void,
    index: number,
    patch: Partial<T>,
  ) => {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const removeRow = <T extends Record<string, any>>(rows: T[], setRows: (rows: T[]) => void, index: number) => {
    setRows(rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const parsePositiveRows = (rows: BagItemRow[]) => {
    const items = rows
      .filter((row) => row.masterProductId && Number(row.quantity) > 0)
      .map((row) => ({
        masterProductId: row.masterProductId,
        quantity: Number(row.quantity),
        notes: row.notes.trim() || undefined,
      }));

    if (items.length === 0) {
      throw new Error('Minimal satu barang harus diisi');
    }

    return items;
  };

  const handleCreateTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.branchId) {
      showToast.error('Nama tim dan cabang wajib diisi');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.createHomecareTeam({
        name: teamForm.name.trim(),
        branchId: teamForm.branchId,
        teamCode: teamForm.teamCode.trim() || undefined,
        description: teamForm.description.trim() || undefined,
      });
      setTeamForm((current) => ({ ...current, name: '', teamCode: '', description: '' }));
      await resetAfterAction('Tim homecare berhasil dibuat');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal membuat tim homecare'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberForm.teamId || !memberForm.userId) {
      showToast.error('Pilih tim dan staff');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.addHomecareTeamMember(memberForm.teamId, {
        userId: memberForm.userId,
        role: memberForm.role as any,
        notes: memberForm.notes.trim() || undefined,
      });
      setMemberForm((current) => ({ ...current, userId: '', notes: '' }));
      await resetAfterAction('Anggota tim berhasil ditambahkan');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal menambahkan anggota tim'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!window.confirm('Nonaktifkan anggota ini dari tim?')) return;

    try {
      setActionLoading(true);
      await inventoryApi.removeHomecareTeamMember(teamId, userId, 'Dinonaktifkan dari halaman operasional tas');
      await resetAfterAction('Anggota tim berhasil dinonaktifkan');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal menonaktifkan anggota tim'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBag = async () => {
    if (!bagForm.name.trim() || !bagForm.teamId) {
      showToast.error('Nama tas dan tim wajib diisi');
      return;
    }

    const team = teams.find((item) => item.id === bagForm.teamId);
    try {
      setActionLoading(true);
      await inventoryApi.createHomecareBag({
        name: bagForm.name.trim(),
        teamId: bagForm.teamId,
        branchId: bagForm.branchId || team?.branchId,
        bagCode: bagForm.bagCode.trim() || undefined,
        status: bagForm.status as any,
        notes: bagForm.notes.trim() || undefined,
      });
      setBagForm((current) => ({ ...current, name: '', bagCode: '', notes: '' }));
      await resetAfterAction('Tas homecare berhasil dibuat');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal membuat tas homecare'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!requestForm.teamId || !requestForm.bagId || !requestForm.requestNotes.trim()) {
      showToast.error('Tim, tas, dan keterangan request wajib diisi');
      return;
    }

    try {
      const items = parsePositiveRows(requestRows).map((item) => ({
        masterProductId: item.masterProductId,
        requestedQty: item.quantity,
        notes: item.notes,
      }));

      setActionLoading(true);
      await inventoryApi.createHomecareBagRequest({
        teamId: requestForm.teamId,
        bagId: requestForm.bagId,
        priority: requestForm.priority,
        requestNotes: requestForm.requestNotes.trim(),
        items,
      });
      setRequestForm((current) => ({ ...current, requestNotes: '' }));
      setRequestRows([{ masterProductId: '', quantity: '', notes: '' }]);
      await resetAfterAction('Request stok tas berhasil dibuat');
    } catch (error: any) {
      showToast.error(error.message || getErrorMessage(error, 'Gagal membuat request stok tas'));
    } finally {
      setActionLoading(false);
    }
  };

  const startApproveRequest = (request: HomecareBagRequest) => {
    setSelectedRequest(request);
    setRequestAction('approve');
    setReviewNotes('');
    setApprovalRows(request.items.map((item) => ({
      masterProductId: item.masterProductId,
      approvedQty: String(item.finalQty ?? item.requestedQty),
      notes: item.notes || '',
    })));
  };

  const startRejectRequest = (request: HomecareBagRequest) => {
    setSelectedRequest(request);
    setRequestAction('reject');
    setReviewNotes('');
    setApprovalRows([]);
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;

    const items = approvalRows.map((row) => ({
      masterProductId: row.masterProductId,
      approvedQty: Math.max(0, Number(row.approvedQty || 0)),
      notes: row.notes.trim() || undefined,
    }));
    const isPartial = selectedRequest.items.some((item) => {
      const approved = items.find((row) => row.masterProductId === item.masterProductId)?.approvedQty ?? item.requestedQty;
      return approved < item.requestedQty;
    });

    if (isPartial && !reviewNotes.trim()) {
      showToast.error('Catatan wajib diisi untuk approve sebagian');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.approveHomecareBagRequest(selectedRequest.id, {
        items,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setSelectedRequest(null);
      setRequestAction(null);
      await resetAfterAction('Request stok tas berhasil disetujui');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal menyetujui request'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || !reviewNotes.trim()) {
      showToast.error('Catatan penolakan wajib diisi');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.rejectHomecareBagRequest(selectedRequest.id, reviewNotes.trim());
      setSelectedRequest(null);
      setRequestAction(null);
      await resetAfterAction('Request stok tas ditolak');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal menolak request'));
    } finally {
      setActionLoading(false);
    }
  };

  const startShipShipment = (shipment: HomecareBagShipment) => {
    setSelectedShipment(shipment);
    setShipmentAction('ship');
    setShipmentNotes('');
  };

  const startReceiveShipment = (shipment: HomecareBagShipment) => {
    setSelectedShipment(shipment);
    setShipmentAction('receive');
    setShipmentNotes('');
    setReceiveRows(shipment.items.map((item) => ({
      masterProductId: item.masterProductId,
      expectedQty: item.sentQty,
      receivedQty: String(item.receivedQty ?? item.sentQty),
      notes: '',
    })));
  };

  const handleShipShipment = async () => {
    if (!selectedShipment || !shipmentNotes.trim()) {
      showToast.error('Catatan pengiriman wajib diisi');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.shipHomecareBagShipment(selectedShipment.id, { notes: shipmentNotes.trim() });
      setSelectedShipment(null);
      setShipmentAction(null);
      await resetAfterAction('Shipment tas berhasil dikirim');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal mengirim shipment tas'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveShipment = async () => {
    if (!selectedShipment || !shipmentNotes.trim()) {
      showToast.error('Catatan penerimaan wajib diisi');
      return;
    }

    const receivedItems = receiveRows.map((row) => ({
      masterProductId: row.masterProductId,
      receivedQty: Math.max(0, Number(row.receivedQty || 0)),
    }));
    const discrepancies = receiveRows
      .filter((row) => Number(row.receivedQty || 0) !== row.expectedQty)
      .map((row) => ({
        masterProductId: row.masterProductId,
        expectedQty: row.expectedQty,
        receivedQty: Math.max(0, Number(row.receivedQty || 0)),
        discrepancyType: Number(row.receivedQty || 0) < row.expectedQty ? 'SHORTAGE' as const : 'OTHER' as const,
        notes: row.notes.trim() || 'Jumlah diterima berbeda dari jumlah dikirim',
      }));

    try {
      setActionLoading(true);
      await inventoryApi.receiveHomecareBagShipment(selectedShipment.id, {
        receivedItems,
        discrepancies,
        notes: shipmentNotes.trim(),
      });
      setSelectedShipment(null);
      setShipmentAction(null);
      await resetAfterAction(discrepancies.length ? 'Shipment diterima dengan catatan' : 'Shipment tas berhasil diterima');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal menerima shipment tas'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUseStock = async () => {
    if (!selectedBag || !usageNotes.trim()) {
      showToast.error('Pilih tas dan isi catatan pemakaian');
      return;
    }

    try {
      const items = parsePositiveRows(usageRows).map((item) => ({
        ...item,
        unit: productUnit(item.masterProductId),
      }));

      setActionLoading(true);
      await inventoryApi.useHomecareBagStock({
        bagId: selectedBag.id,
        teamId: selectedBag.teamId,
        notes: usageNotes.trim(),
        allowNegativeStock: canAllowNegative ? usageAllowNegative : undefined,
        items,
      });
      setUsageNotes('');
      setUsageRows([{ masterProductId: '', quantity: '', notes: '' }]);
      await resetAfterAction('Pemakaian stok tas berhasil dicatat');
    } catch (error: any) {
      showToast.error(error.message || getErrorMessage(error, 'Gagal mencatat pemakaian stok tas'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnStock = async () => {
    if (!selectedBag || !returnBranchId || !returnNotes.trim()) {
      showToast.error('Pilih tas, cabang tujuan, dan isi catatan retur');
      return;
    }

    try {
      const items = parsePositiveRows(returnRows).map((item, index) => ({
        ...item,
        isReusable: returnRows[index]?.isReusable ?? true,
        condition: returnRows[index]?.condition?.trim() || undefined,
      }));

      setActionLoading(true);
      await inventoryApi.returnHomecareBagStock({
        bagId: selectedBag.id,
        teamId: selectedBag.teamId,
        toBranchId: returnBranchId,
        notes: returnNotes.trim(),
        allowNegativeStock: canAllowNegative ? returnAllowNegative : undefined,
        items,
      });
      setReturnNotes('');
      setReturnRows([{ masterProductId: '', quantity: '', notes: '', isReusable: true, condition: 'BAIK' }]);
      await resetAfterAction('Retur stok tas berhasil dicatat');
    } catch (error: any) {
      showToast.error(error.message || getErrorMessage(error, 'Gagal mencatat retur stok tas'));
    } finally {
      setActionLoading(false);
    }
  };

  const fillOpnameFromStock = () => {
    if (!bagStock?.stocks.length) {
      showToast.error('Stok tas belum tersedia');
      return;
    }
    setOpnameRows(bagStock.stocks.map((stock) => ({
      masterProductId: stock.masterProductId,
      physicalQty: String(stock.stock),
      notes: '',
    })));
  };

  const handleCreateOpname = async () => {
    if (!selectedBag || !opnameNotes.trim()) {
      showToast.error('Pilih tas dan isi catatan opname');
      return;
    }

    const items = opnameRows
      .filter((row) => row.masterProductId && row.physicalQty !== '')
      .map((row) => ({
        masterProductId: row.masterProductId,
        physicalQty: Math.max(0, Number(row.physicalQty || 0)),
        notes: row.notes.trim() || undefined,
      }));

    if (items.length === 0) {
      showToast.error('Minimal satu barang harus dicek');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.createHomecareBagOpname({
        bagId: selectedBag.id,
        teamId: selectedBag.teamId,
        status: 'COMPLETED',
        notes: opnameNotes.trim(),
        createAdjustments: opnameCreateAdjustments,
        items,
      });
      setOpnameNotes('');
      setOpnameRows([{ masterProductId: '', physicalQty: '', notes: '' }]);
      await resetAfterAction('Opname tas berhasil dicatat');
    } catch (error: any) {
      showToast.error(getErrorMessage(error, 'Gagal mencatat opname tas'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!mounted || loading) return <PageLoading />;

  const ProductSelect = ({
    value,
    onChange,
    source = products,
  }: {
    value: string;
    onChange: (value: string) => void;
    source?: HomecareProduct[];
  }) => (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
    >
      <option value="">Pilih barang</option>
      {source.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name} {product.sku ? `(${product.sku})` : ''}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Tas & Tim Homecare</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Operasional stok tas, request, pengiriman, pemakaian, retur, dan opname.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={actionLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <RefreshCw size={16} />
          Muat Ulang
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryBox icon={<Users size={18} />} label="Tim Aktif" value={teams.length} />
        <SummaryBox icon={<Boxes size={18} />} label="Tas Aktif" value={bags.length} />
        <SummaryBox icon={<ClipboardList size={18} />} label="Request Pending" value={pendingRequests.length} />
        <SummaryBox icon={<Truck size={18} />} label="Shipment Jalan" value={preparingShipments.length + shippedShipments.length} />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${
              activeTab === tab.key
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bags' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Boxes size={18} />} title="Daftar Tas" />
            <div className="mt-4 space-y-3">
              {bags.length === 0 ? (
                <EmptyState text="Belum ada tas homecare." />
              ) : (
                bags.map((bag) => (
                  <button
                    key={bag.id}
                    type="button"
                    onClick={() => setSelectedBagId(bag.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      selectedBagId === bag.id
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">{bag.name}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {bag.bagCode} · {bag.teamName || '-'} · {bag.branchName || '-'}
                        </div>
                      </div>
                      <StatusBadge label={bag.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-500">
                      <span>{bag.stockCount} item</span>
                      <span>{bag.totalStockQty} stok</span>
                      <span className={bag.lowStockCount > 0 ? 'text-amber-500' : ''}>{bag.lowStockCount} rendah</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Package size={18} />} title="Stok Tas" />
            {!selectedBag ? (
              <EmptyState text="Pilih tas untuk melihat stok." />
            ) : stockLoading ? (
              <div className="py-10 text-center text-sm text-neutral-500">Memuat stok tas...</div>
            ) : (
              <div className="mt-4">
                <div className="mb-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                  <div className="font-semibold text-neutral-900 dark:text-white">{bagStock?.name || selectedBag.name}</div>
                  <div className="text-neutral-500">{bagStock?.bagCode || selectedBag.bagCode} · {bagStock?.team?.name || selectedBag.teamName}</div>
                </div>
                {bagStock?.stocks.length ? (
                  <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
                        <tr>
                          <th className="px-3 py-2">Barang</th>
                          <th className="px-3 py-2">Stok</th>
                          <th className="px-3 py-2">Minimum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {bagStock.stocks.map((stock) => (
                          <tr key={stock.id}>
                            <td className="px-3 py-3">
                              <div className="font-medium text-neutral-900 dark:text-white">{stock.productName || productName(stock.masterProductId)}</div>
                              <div className="text-xs text-neutral-500">{stock.sku || productMap.get(stock.masterProductId)?.sku || '-'}</div>
                            </td>
                            <td className={`px-3 py-3 font-semibold ${stock.stock <= stock.minThreshold ? 'text-amber-500' : 'text-neutral-800 dark:text-neutral-100'}`}>
                              {stock.stock} {stock.baseUnit || productUnit(stock.masterProductId)}
                            </td>
                            <td className="px-3 py-3 text-neutral-500">{stock.minThreshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState text="Tas ini belum memiliki stok." />
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Plus size={18} />} title="Request Stok Tas" />
            {canRequestBagStock ? (
              <div className="mt-4 space-y-3">
                <SelectField label="Tim" value={requestForm.teamId} onChange={(value) => {
                  setRequestForm((current) => ({ ...current, teamId: value, bagId: '' }));
                }}>
                  <option value="">Pilih tim</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </SelectField>
                <SelectField label="Tas" value={requestForm.bagId} onChange={(value) => setRequestForm((current) => ({ ...current, bagId: value }))}>
                  <option value="">Pilih tas</option>
                  {bags.filter((bag) => !requestForm.teamId || bag.teamId === requestForm.teamId).map((bag) => (
                    <option key={bag.id} value={bag.id}>{bag.name} ({bag.bagCode})</option>
                  ))}
                </SelectField>
                <SelectField label="Prioritas" value={requestForm.priority} onChange={(value) => setRequestForm((current) => ({ ...current, priority: value }))}>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </SelectField>
                <TextArea label="Keterangan" value={requestForm.requestNotes} onChange={(value) => setRequestForm((current) => ({ ...current, requestNotes: value }))} />
                <ItemRows
                  rows={requestRows}
                  products={products}
                  productUnit={productUnit}
                  productSelect={ProductSelect}
                  onChange={(index, patch) => updateRow(requestRows, setRequestRows, index, patch)}
                  onRemove={(index) => removeRow(requestRows, setRequestRows, index)}
                  onAdd={() => setRequestRows([...requestRows, { masterProductId: '', quantity: '', notes: '' }])}
                />
                <ActionButton icon={<ClipboardList size={16} />} onClick={handleCreateRequest} loading={actionLoading}>
                  Buat Request
                </ActionButton>
              </div>
            ) : (
              <EmptyState text="Role ini tidak membuat request stok tas." />
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<ClipboardList size={18} />} title="Daftar Request" />
            <div className="mt-4 space-y-3">
              {requests.length === 0 ? <EmptyState text="Belum ada request stok tas." /> : requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-white">{request.requestCode}</div>
                      <div className="mt-1 text-xs text-neutral-500">{request.bagName || request.bagCode} · {request.teamName || '-'}</div>
                    </div>
                    <StatusBadge label={requestStatusLabels[request.status] || request.status} status={request.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {request.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3">
                        <span>{productName(item.masterProductId)}</span>
                        <span>{item.finalQty ?? item.approvedQty ?? item.requestedQty} / {item.requestedQty} {productUnit(item.masterProductId)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">{formatDate(request.createdAt)}</div>
                  {canReviewRequests && request.status === 'PENDING' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => startApproveRequest(request)}>
                        Approve
                      </button>
                      <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700" onClick={() => startRejectRequest(request)}>
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedRequest && requestAction && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="mb-3 font-semibold text-neutral-900 dark:text-white">
                  {requestAction === 'approve' ? 'Approve Request' : 'Tolak Request'} · {selectedRequest.requestCode}
                </div>
                {requestAction === 'approve' && (
                  <div className="space-y-2">
                    {approvalRows.map((row, index) => (
                      <div key={row.masterProductId} className="grid gap-2 md:grid-cols-[1fr_120px]">
                        <div className="rounded-lg bg-white px-3 py-2 text-sm dark:bg-neutral-900">{productName(row.masterProductId)}</div>
                        <input
                          type="number"
                          min="0"
                          value={row.approvedQty}
                          onChange={(event) => updateRow(approvalRows, setApprovalRows, index, { approvedQty: event.target.value })}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <TextArea label="Catatan Review" value={reviewNotes} onChange={setReviewNotes} />
                <div className="mt-3 flex gap-2">
                  <ActionButton icon={requestAction === 'approve' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} onClick={requestAction === 'approve' ? handleApproveRequest : handleRejectRequest} loading={actionLoading}>
                    {requestAction === 'approve' ? 'Simpan Approve' : 'Simpan Penolakan'}
                  </ActionButton>
                  <button className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold dark:border-neutral-700" onClick={() => setSelectedRequest(null)}>
                    Batal
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'shipments' && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <SectionTitle icon={<Truck size={18} />} title="Pengiriman Stok Tas" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {shipments.length === 0 ? <EmptyState text="Belum ada shipment tas." /> : shipments.map((shipment) => (
              <div key={shipment.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral-900 dark:text-white">{shipment.shipmentCode}</div>
                    <div className="mt-1 text-xs text-neutral-500">{shipment.bagName || shipment.bagCode} · {formatDate(shipment.createdAt)}</div>
                  </div>
                  <StatusBadge label={shipmentStatusLabels[shipment.status] || shipment.status} status={shipment.status} />
                </div>
                <div className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {shipment.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <span>{productName(item.masterProductId)}</span>
                      <span>{item.receivedQty ?? item.sentQty} / {item.sentQty} {productUnit(item.masterProductId)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canShipStock && shipment.status === 'PREPARING' && (
                    <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => startShipShipment(shipment)}>
                      Kirim
                    </button>
                  )}
                  {shipment.status === 'SHIPPED' && (
                    <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => startReceiveShipment(shipment)}>
                      Terima
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedShipment && shipmentAction && (
            <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="mb-3 font-semibold text-neutral-900 dark:text-white">
                {shipmentAction === 'ship' ? 'Kirim Shipment' : 'Terima Shipment'} · {selectedShipment.shipmentCode}
              </div>
              {shipmentAction === 'receive' && (
                <div className="space-y-2">
                  {receiveRows.map((row, index) => (
                    <div key={row.masterProductId} className="grid gap-2 md:grid-cols-[1fr_110px_1fr]">
                      <div className="rounded-lg bg-white px-3 py-2 text-sm dark:bg-neutral-900">{productName(row.masterProductId)} · kirim {row.expectedQty}</div>
                      <input
                        type="number"
                        min="0"
                        value={row.receivedQty}
                        onChange={(event) => updateRow(receiveRows, setReceiveRows, index, { receivedQty: event.target.value })}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <input
                        value={row.notes}
                        onChange={(event) => updateRow(receiveRows, setReceiveRows, index, { notes: event.target.value })}
                        placeholder="Catatan selisih"
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </div>
                  ))}
                </div>
              )}
              <TextArea label="Catatan" value={shipmentNotes} onChange={setShipmentNotes} />
              <div className="mt-3 flex gap-2">
                <ActionButton icon={shipmentAction === 'ship' ? <Send size={16} /> : <CheckCircle2 size={16} />} onClick={shipmentAction === 'ship' ? handleShipShipment : handleReceiveShipment} loading={actionLoading}>
                  {shipmentAction === 'ship' ? 'Simpan Kirim' : 'Simpan Terima'}
                </ActionButton>
                <button className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold dark:border-neutral-700" onClick={() => setSelectedShipment(null)}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'movements' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Package size={18} />} title="Pakai Stok" />
            <BagSelector bags={bags} value={selectedBagId} onChange={setSelectedBagId} />
            <TextArea label="Catatan" value={usageNotes} onChange={setUsageNotes} />
            <ItemRows
              rows={usageRows}
              products={stockProducts.length ? stockProducts : products}
              productUnit={productUnit}
              productSelect={ProductSelect}
              onChange={(index, patch) => updateRow(usageRows, setUsageRows, index, patch)}
              onRemove={(index) => removeRow(usageRows, setUsageRows, index)}
              onAdd={() => setUsageRows([...usageRows, { masterProductId: '', quantity: '', notes: '' }])}
            />
            {canAllowNegative && <Checkbox label="Izinkan stok minus" checked={usageAllowNegative} onChange={setUsageAllowNegative} />}
            <ActionButton icon={<Package size={16} />} onClick={handleUseStock} loading={actionLoading}>Catat Pemakaian</ActionButton>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<RotateCcw size={18} />} title="Retur ke Cabang" />
            <BagSelector bags={bags} value={selectedBagId} onChange={setSelectedBagId} />
            <SelectField label="Cabang Tujuan" value={returnBranchId} onChange={setReturnBranchId}>
              <option value="">Pilih cabang</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </SelectField>
            <TextArea label="Catatan" value={returnNotes} onChange={setReturnNotes} />
            <ItemRows
              rows={returnRows}
              products={stockProducts.length ? stockProducts : products}
              productUnit={productUnit}
              productSelect={ProductSelect}
              onChange={(index, patch) => updateRow(returnRows, setReturnRows, index, patch)}
              onRemove={(index) => removeRow(returnRows, setReturnRows, index)}
              onAdd={() => setReturnRows([...returnRows, { masterProductId: '', quantity: '', notes: '', isReusable: true, condition: 'BAIK' }])}
              showReturnFields
            />
            {canAllowNegative && <Checkbox label="Izinkan stok minus" checked={returnAllowNegative} onChange={setReturnAllowNegative} />}
            <ActionButton icon={<RotateCcw size={16} />} onClick={handleReturnStock} loading={actionLoading}>Catat Retur</ActionButton>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<ShieldCheck size={18} />} title="Opname Tas" />
            <BagSelector bags={bags} value={selectedBagId} onChange={setSelectedBagId} />
            <TextArea label="Catatan" value={opnameNotes} onChange={setOpnameNotes} />
            <button type="button" onClick={fillOpnameFromStock} className="mb-3 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700">
              Isi Dari Stok Sistem
            </button>
            <div className="space-y-2">
              {opnameRows.map((row, index) => (
                <div key={`${row.masterProductId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_100px_auto]">
                  <ProductSelect value={row.masterProductId} onChange={(value) => updateRow(opnameRows, setOpnameRows, index, { masterProductId: value })} source={stockProducts.length ? stockProducts : products} />
                  <input
                    type="number"
                    min="0"
                    value={row.physicalQty}
                    onChange={(event) => updateRow(opnameRows, setOpnameRows, index, { physicalQty: event.target.value })}
                    placeholder="Fisik"
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <button type="button" onClick={() => removeRow(opnameRows, setOpnameRows, index)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                    Hapus
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setOpnameRows([...opnameRows, { masterProductId: '', physicalQty: '', notes: '' }])} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700">
                Tambah Barang
              </button>
            </div>
            <Checkbox label="Buat penyesuaian stok" checked={opnameCreateAdjustments} onChange={setOpnameCreateAdjustments} />
            <ActionButton icon={<ShieldCheck size={16} />} onClick={handleCreateOpname} loading={actionLoading}>Simpan Opname</ActionButton>
          </section>
        </div>
      )}

      {activeTab === 'setup' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Users size={18} />} title="Setup Tim & Tas" />
            {canManageSetup ? (
              <div className="mt-4 space-y-6">
                <div className="space-y-3">
                  <div className="font-semibold text-neutral-900 dark:text-white">Tim Baru</div>
                  <InputField label="Nama Tim" value={teamForm.name} onChange={(value) => setTeamForm((current) => ({ ...current, name: value }))} />
                  <InputField label="Kode Tim" value={teamForm.teamCode} onChange={(value) => setTeamForm((current) => ({ ...current, teamCode: value }))} placeholder="Auto jika kosong" />
                  <SelectField label="Cabang" value={teamForm.branchId} onChange={(value) => setTeamForm((current) => ({ ...current, branchId: value }))}>
                    <option value="">Pilih cabang</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </SelectField>
                  <TextArea label="Deskripsi" value={teamForm.description} onChange={(value) => setTeamForm((current) => ({ ...current, description: value }))} />
                  <ActionButton icon={<Plus size={16} />} onClick={handleCreateTeam} loading={actionLoading}>Buat Tim</ActionButton>
                </div>

                <div className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <div className="font-semibold text-neutral-900 dark:text-white">Tambah Anggota</div>
                  <SelectField label="Tim" value={memberForm.teamId} onChange={(value) => setMemberForm((current) => ({ ...current, teamId: value }))}>
                    <option value="">Pilih tim</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </SelectField>
                  <SelectField label="Staff" value={memberForm.userId} onChange={(value) => setMemberForm((current) => ({ ...current, userId: value }))}>
                    <option value="">Pilih staff</option>
                    {staffOptions.map((staff) => <option key={staff.userId} value={staff.userId}>{staff.fullName} · {staff.role}</option>)}
                  </SelectField>
                  <SelectField label="Role Tim" value={memberForm.role} onChange={(value) => setMemberForm((current) => ({ ...current, role: value }))}>
                    {teamMemberRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </SelectField>
                  <InputField label="Catatan" value={memberForm.notes} onChange={(value) => setMemberForm((current) => ({ ...current, notes: value }))} />
                  <ActionButton icon={<Users size={16} />} onClick={handleAddMember} loading={actionLoading}>Tambah Anggota</ActionButton>
                </div>

                <div className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <div className="font-semibold text-neutral-900 dark:text-white">Tas Baru</div>
                  <InputField label="Nama Tas" value={bagForm.name} onChange={(value) => setBagForm((current) => ({ ...current, name: value }))} />
                  <InputField label="Kode Tas" value={bagForm.bagCode} onChange={(value) => setBagForm((current) => ({ ...current, bagCode: value }))} placeholder="Auto jika kosong" />
                  <SelectField label="Tim" value={bagForm.teamId} onChange={(value) => {
                    const team = teams.find((item) => item.id === value);
                    setBagForm((current) => ({ ...current, teamId: value, branchId: team?.branchId || current.branchId }));
                  }}>
                    <option value="">Pilih tim</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </SelectField>
                  <SelectField label="Status" value={bagForm.status} onChange={(value) => setBagForm((current) => ({ ...current, status: value }))}>
                    <option value="ACTIVE">Aktif</option>
                    <option value="IN_CHECKING">Dalam Pengecekan</option>
                    <option value="DAMAGED">Rusak</option>
                    <option value="INACTIVE">Nonaktif</option>
                    <option value="LOST">Hilang</option>
                  </SelectField>
                  <TextArea label="Catatan" value={bagForm.notes} onChange={(value) => setBagForm((current) => ({ ...current, notes: value }))} />
                  <ActionButton icon={<Boxes size={16} />} onClick={handleCreateBag} loading={actionLoading}>Buat Tas</ActionButton>
                </div>
              </div>
            ) : (
              <EmptyState text="Setup tim hanya untuk pengelola stok pusat." />
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <SectionTitle icon={<Users size={18} />} title="Tim Homecare" />
            <div className="mt-4 space-y-3">
              {teams.length === 0 ? <EmptyState text="Belum ada tim homecare." /> : teams.map((team) => (
                <div key={team.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-white">{team.name}</div>
                      <div className="text-xs text-neutral-500">{team.teamCode} · {team.branchName || '-'}</div>
                    </div>
                    <div className="text-xs text-neutral-500">{team.memberCount} anggota · {team.bagCount} tas</div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                        <span>
                          <span className="font-medium text-neutral-900 dark:text-white">{member.fullName}</span>
                          <span className="ml-2 text-xs text-neutral-500">{member.role}</span>
                        </span>
                        {canManageSetup && (
                          <button type="button" onClick={() => handleRemoveMember(team.id, member.userId)} className="text-xs font-semibold text-red-500">
                            Nonaktif
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{value}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">{icon}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-base font-bold text-neutral-900 dark:text-white">
      <span className="text-emerald-500">{icon}</span>
      {title}
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status || label)}`}>
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500 dark:border-neutral-800">{text}</div>;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      >
        {children}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="my-3 flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ActionButton({
  icon,
  children,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {icon}
      {loading ? 'Memproses...' : children}
    </button>
  );
}

function BagSelector({ bags, value, onChange }: { bags: HomecareBag[]; value: string; onChange: (value: string) => void }) {
  return (
    <SelectField label="Tas" value={value} onChange={onChange}>
      <option value="">Pilih tas</option>
      {bags.map((bag) => <option key={bag.id} value={bag.id}>{bag.name} ({bag.bagCode})</option>)}
    </SelectField>
  );
}

function ItemRows({
  rows,
  products,
  productUnit,
  productSelect,
  onChange,
  onRemove,
  onAdd,
  showReturnFields = false,
}: {
  rows: BagItemRow[];
  products: HomecareProduct[];
  productUnit: (masterProductId: string) => string;
  productSelect: React.ComponentType<{ value: string; onChange: (value: string) => void; source?: HomecareProduct[] }>;
  onChange: (index: number, patch: Partial<BagItemRow>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  showReturnFields?: boolean;
}) {
  const ProductSelect = productSelect;
  return (
    <div className="mt-3 space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_100px_auto]">
          <ProductSelect value={row.masterProductId} onChange={(value) => onChange(index, { masterProductId: value })} source={products} />
          <input
            type="number"
            min="0"
            value={row.quantity}
            onChange={(event) => onChange(index, { quantity: event.target.value })}
            placeholder={row.masterProductId ? productUnit(row.masterProductId) : 'Qty'}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button type="button" onClick={() => onRemove(index)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
            Hapus
          </button>
          {showReturnFields && (
            <div className="grid gap-2 md:col-span-3 md:grid-cols-[1fr_140px]">
              <input
                value={row.condition || ''}
                onChange={(event) => onChange(index, { condition: event.target.value })}
                placeholder="Kondisi"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                <input
                  type="checkbox"
                  checked={row.isReusable ?? true}
                  onChange={(event) => onChange(index, { isReusable: event.target.checked })}
                />
                Reusable
              </label>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700">
        Tambah Barang
      </button>
    </div>
  );
}
