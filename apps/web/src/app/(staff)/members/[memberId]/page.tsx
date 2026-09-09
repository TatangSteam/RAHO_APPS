'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { deleteMemberApi, getMemberDetailApi, sendNotificationApi, updateMemberApi } from '@/lib/membersApi';
import { packagesApi, type AssignPackageData, type EditPackageData } from '@/lib/packagesApi';
import { invoiceApi } from '@/lib/invoiceApi';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import type { MemberDetail } from '@/types/member';
import type { PackageDisplay, PackagePricing, ExtendedBoosterType, ServiceType, AddOnType, MemberPackage, StandaloneAddOn } from '@/types/package';
import type { Invoice } from '@/types/invoice';
import { useAuthStore } from '@/stores/authStore';
import { confirm as confirmDialog, showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';
import { persistActiveTabInUrl, usePersistentTabs } from '@/hooks/usePersistentTabs';

// Components
import MemberHeader from '@/components/members/MemberHeader';
import MemberStatusCards from '@/components/members/MemberStatusCards';
import MemberProfileTab from '@/components/members/MemberProfileTab';
import MemberPackagesTab from '@/components/members/MemberPackagesTab';
import MemberSessionsTab from '@/components/members/MemberSessionsTab';
import MemberDiagnosesTab from '@/components/members/MemberDiagnosesTab';
import MemberTherapyPlansTab from '@/components/members/MemberTherapyPlansTab';
import SendNotificationModal from '@/components/members/SendNotificationModal';
import AssignPackageModal from '@/components/members/AssignPackageModal';
import AssignAddOnModal, { type AddOnTransactionData } from '@/components/members/AssignAddOnModal';
import MemberAddOnsTab from '@/components/members/MemberAddOnsTab';
import VerifyPaymentModal from '@/components/members/VerifyPaymentModal';
import PackageRefundModal from '@/components/members/PackageRefundModal';
import PackageCancelModal from '@/components/members/PackageCancelModal';
import EditPackageModal from '@/components/members/EditPackageModal';
import { buildEditPackageSelections } from '@/components/members/EditPackageModal/editPackageSelections';
import VoucherBalanceEditModal from '@/components/members/VoucherBalanceEditModal';
import RefundDetailModal from '@/components/members/RefundDetailModal';
import MemberCredentialsModal from '@/components/members/MemberCredentialsModal';
import UploadDocumentsModal from '@/components/members/UploadDocumentsModal';
import MemberLabResultsTab from '@/components/members/MemberLabResultsTab';
import MemberEditModal from '@/components/members/MemberEditModal';
import MemberDestructionModal from '@/components/members/MemberDestructionModal';
import { getActiveMemberPackagesByType } from '@/components/members/memberStatusPresentation';
import {
  ClipboardList,
  Droplets,
  FlaskConical,
  Package,
  Pill,
  Plus,
  RefreshCw,
  Stethoscope,
  UserRound,
} from 'lucide-react';

type MemberDetailTab = 'profil' | 'paket' | 'air-nano-addon' | 'sesi' | 'diagnosa' | 'therapy-plan' | 'lab-results';

const MEMBER_DETAIL_TABS: MemberDetailTab[] = ['profil', 'paket', 'air-nano-addon', 'therapy-plan', 'diagnosa', 'sesi', 'lab-results'];

const MEMBER_DETAIL_TAB_META: Record<MemberDetailTab, {
  label: string;
  icon: typeof UserRound;
}> = {
  profil: { label: 'Profil', icon: UserRound },
  paket: { label: 'Paket', icon: Package },
  'air-nano-addon': { label: 'Air Nano & Add-On', icon: Droplets },
  sesi: { label: 'Sesi Terapi', icon: Stethoscope },
  diagnosa: { label: 'Diagnosis', icon: ClipboardList },
  'therapy-plan': { label: 'Therapy Plan', icon: Pill },
  'lab-results': { label: 'Hasil Lab', icon: FlaskConical },
};

function isMemberDetailTab(value: string | null): value is MemberDetailTab {
  return Boolean(value && MEMBER_DETAIL_TABS.includes(value as MemberDetailTab));
}

function getJakartaDateInputValue(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getMemberAddOnTransactions(items: PackageDisplay[]): StandaloneAddOn[] {
  const addOns = new Map<string, StandaloneAddOn>();

  items.forEach(item => {
    if (item.isGroup) {
      item.addOns?.forEach(addOn => addOns.set(addOn.addOnId, addOn));
      return;
    }
    if ('isAddOn' in item && item.isAddOn) {
      addOns.set(item.addOnId, item);
    }
  });

  return Array.from(addOns.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function getPackageOnlyTransactions(items: PackageDisplay[]): PackageDisplay[] {
  return items.filter(item => !('isAddOn' in item && item.isAddOn));
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const memberId = params.memberId as string;
  const { user } = useAuthStore();
  const requestedInitialTab = searchParams.get('tab');
  const initialTab = isMemberDetailTab(requestedInitialTab) ? requestedInitialTab : 'profil';

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeTab, visitedTabs, activateTab } = usePersistentTabs<MemberDetailTab>(initialTab);
  const loadedPricingBranchIdRef = useRef<string | null>(null);
  const loadingPricingBranchIdRef = useRef<string | null>(null);
  
  // Notification modal state
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Package state
  const [packages, setPackages] = useState<PackageDisplay[]>([]);
  const packageTransactions = useMemo(() => getPackageOnlyTransactions(packages), [packages]);
  const addOnTransactions = useMemo(() => getMemberAddOnTransactions(packages), [packages]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [msoStaff, setMsoStaff] = useState<StaffMember[]>([]);
  const [loadingMsoStaff, setLoadingMsoStaff] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
  const [loadingPricings, setLoadingPricings] = useState(false);
  const [assignData, setAssignData] = useState({
    selectedPackages: [] as Array<{ 
      pricingId: string; 
      quantity: number;
      boosterType?: ExtendedBoosterType;
      serviceType?: ServiceType;
    }>,
    selectedAddOns: [] as Array<{
      type: AddOnType;
      code: string;
      name: string;
      price: number;
      quantity: number;
    }>,
    discountPercent: 0,
    discountAmount: 0,
    discountNote: '',
    notes: '',
    paymentPlan: {
      type: 'FULL_PAYMENT' as 'FULL_PAYMENT' | 'INSTALLMENT',
      installmentCount: 2,
    },
  });
  const [addOnTransactionData, setAddOnTransactionData] = useState<AddOnTransactionData>({
    selectedAddOns: [],
    transactionDate: getJakartaDateInputValue(),
    sellerMsoId: '',
    notes: '',
  });
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyPaidAmount, setVerifyPaidAmount] = useState<number>(0);
  const [verifyInvoice, setVerifyInvoice] = useState<Invoice | null>(null);
  const [paymentProof, setPaymentProof] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null });
  const [submitting, setSubmitting] = useState(false);
  const [selectedPackageProof, setSelectedPackageProof] = useState<{ url: string | null; fileName: string | null; status: string }>({ url: null, fileName: null, status: 'PENDING_PAYMENT' });

  const getRemainingInvoiceAmount = (invoice: Invoice | null) => {
    if (!invoice) return 0;
    if (Number(invoice.totalAmount || 0) > 0) return Number(invoice.totalAmount);

    const paidTotal = invoice.payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
    return Math.max(0, Number(invoice.totalPurchaseAmount || 0) - paidTotal);
  };

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundPackageCode, setRefundPackageCode] = useState('');
  const [refundFinalPrice, setRefundFinalPrice] = useState(0);
  const [returnAddOnsToStock, setReturnAddOnsToStock] = useState(false);
  const [refundProof, setRefundProof] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null });

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPackageCode, setCancelPackageCode] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    selectedPackages: [] as Array<{ 
      pricingId: string; 
      quantity: number;
      boosterType?: ExtendedBoosterType;
      serviceType?: ServiceType;
    }>,
    selectedAddOns: [] as Array<{
      type: AddOnType;
      code: string;
      name: string;
      price: number;
      quantity: number;
    }>,
    discountPercent: 0,
    discountAmount: 0,
    discountNote: '',
    notes: ''
  });
  const [editingPackageId, setEditingPackageId] = useState('');
  const [editingPackages, setEditingPackages] = useState<MemberPackage[]>([]);
  const [showBasicVoucherEditModal, setShowBasicVoucherEditModal] = useState(false);
  const [showBoosterVoucherEditModal, setShowBoosterVoucherEditModal] = useState(false);

  // Refund detail modal state
  const [showRefundDetailModal, setShowRefundDetailModal] = useState(false);
  const [refundDetailData, setRefundDetailData] = useState<{
    packageCode: string;
    refundAmount: number;
    refundReason: string;
    refundedBy?: string;
    refundedAt?: string;
    refundProofUrl?: string;
    refundProofFileName?: string;
  } | null>(null);

  // Credentials modal state (Super Admin only)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  // Upload documents modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [updatingLifeStatus, setUpdatingLifeStatus] = useState(false);

  // Edit member modal state
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [deletingMember, setDeletingMember] = useState(false);
  const [showDestructionModal, setShowDestructionModal] = useState(false);

  // Handler for AssignPackageModal data changes
  const handleAssignDataChange = (data: typeof assignData) => {
    setAssignData(data);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const canEditMember =
    isSuperAdmin ||
    (isAdminManager && user?.adminManagerAccessScope !== 'MEMBER_VIEW_ONLY');
  const canMutateMember = !isAdminManager;
  const canSendNotification = Boolean(user && canMutateMember);
  const canDeleteMember = isSuperAdmin;
  const canAssignPackage = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN'].includes(user?.role || '');
  const canPrivilegedEditPackage =
    isSuperAdmin ||
    (isAdminManager && user?.adminManagerAccessScope !== 'MEMBER_VIEW_ONLY');
  const canEditPackage = canAssignPackage || canPrivilegedEditPackage;
  const canEditWaitingVerificationPackage = canPrivilegedEditPackage;
  const canEditVerifiedPackage = canPrivilegedEditPackage;
  const canUploadDocuments = [
    'ADMIN_LAYANAN',
    'ADMIN_CABANG',
    'ADMIN_MANAGER',
    'SUPER_ADMIN',
    'DOCTOR',
    'NURSE',
  ].includes(user?.role || '');
  const canEditLifeStatus = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN'].includes(user?.role || '');
  const canCreateDiagnosis = [
    'DOCTOR',
    'NURSE',
    'ADMIN_LAYANAN',
    'ADMIN_CABANG',
    'SUPER_ADMIN',
  ].includes(user?.role || '');
  
  // The upload CTA specifically reflects informed-consent availability.
  const hasDocuments = member ? (
    member.documents?.some(doc => 
      doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN'
    ) || false
  ) : false;

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    activateTab(isMemberDetailTab(requestedTab) ? requestedTab : 'profil');
  }, [activateTab, searchParams]);

  const handleTabChange = (tab: MemberDetailTab) => {
    activateTab(tab);

    // Persist the active section without invoking Next navigation, so mounted
    // tab state remains intact and refreshing restores the selected section.
    persistActiveTabInUrl(tab, 'profil');
  };

  const loadMemberDetail = useCallback(async (showPageLoading = true) => {
    try {
      if (showPageLoading) setLoading(true);
      devLog('📥 [Member Detail] Loading member detail for:', memberId);
      const startTime = performance.now();
      
      const data = await getMemberDetailApi(memberId);
      
      const endTime = performance.now();
      devLog(`⏱️ [Member Detail] loadMemberDetail: ${(endTime - startTime).toFixed(2)}ms`);
      devLog('✅ [Member Detail] Member data loaded:', data.memberNo, data.profile.fullName);
      setMember(data);
    } catch (error) {
      assertCaughtError(error);
      devError('❌ [Member Detail] Failed to load member detail:', error);
      devError('❌ [Member Detail] Error response:', error.response?.data);
      devError('❌ [Member Detail] Error status:', error.response?.status);
      alert('Gagal memuat detail member: ' + (error.response?.data?.error?.message || error.message));
      router.back();
    } finally {
      if (showPageLoading) setLoading(false);
      devLog('🏁 [Member Detail] Loading finished');
    }
  }, [memberId, router]);

  const loadPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      devLog('📦 [Member Detail] Loading packages for member:', memberId);
      const startTime = performance.now();
      
      const data = await packagesApi.getMemberPackages(memberId);
      
      const endTime = performance.now();
      devLog(`⏱️ [Member Detail] loadPackages: ${(endTime - startTime).toFixed(2)}ms`);
      devLog('✅ [Member Detail] Packages loaded:', data.packages?.length || 0, 'packages');
      setPackages(data.packages || []);
    } catch (error) {
      assertCaughtError(error);
      devError('❌ [Member Detail] Failed to load packages:', error);
      showToast.error('Gagal memuat data paket: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setLoadingPackages(false);
      devLog('🏁 [Member Detail] Package loading finished');
    }
  }, [memberId]);

  const loadPricings = useCallback(async () => {
    try {
      setLoadingPricings(true);
      // Fetch actual pricing from backend
      // Pass member's registration branch to get correct pricing
      const memberBranchId = member?.registrationBranch?.id;
      devLog('Loading pricings for member branch:', memberBranchId);
      const data = await packagesApi.getPackagePricings(memberBranchId, { branchOnly: true });
      devLog('Loaded pricings:', data);
      setPricings(Array.isArray(data) ? data : []);
      return true;
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load pricings:', error);
      showToast.error('Gagal memuat harga paket');
      // Set empty array as fallback
      setPricings([]);
      return false;
    } finally {
      setLoadingPricings(false);
    }
  }, [member?.registrationBranch?.id]);

  const handleOpenAssignPackage = async () => {
    const pricingBranchKey = member?.registrationBranch?.id;
    if (!pricingBranchKey) {
      showToast.error('Cabang registrasi member tidak ditemukan');
      return;
    }

    // Always refresh before opening. The catalog may have changed after this
    // member page was mounted, especially when pricing is configured in
    // another tab or by another administrator.
    const loaded = await loadPricings();
    if (!loaded) return;

    loadedPricingBranchIdRef.current = pricingBranchKey;
    setShowAssignModal(true);
  };

  const handleOpenAddOnModal = async () => {
    const branchId = member?.registrationBranch?.id;
    if (!branchId) {
      showToast.error('Cabang registrasi member tidak ditemukan');
      return;
    }

    setShowAddOnModal(true);
    setLoadingMsoStaff(true);
    try {
      const staff = await usersApi.getAdminLayanan(branchId);
      setMsoStaff(staff);
    } catch (error) {
      assertCaughtError(error);
      devError('Load MSO staff error:', error);
      setMsoStaff([]);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat daftar MSO');
    } finally {
      setLoadingMsoStaff(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!member || !canDeleteMember || deletingMember) return;

    const memberName = member.profile?.fullName || member.memberNo || 'member ini';
    const confirmed = await confirmDialog.action(
      'Nonaktifkan Member',
      `${memberName} akan dinonaktifkan dan tetap tersimpan dalam riwayat.`,
      'Nonaktifkan',
    );
    if (!confirmed) return;

    try {
      setDeletingMember(true);
      await deleteMemberApi(memberId);
      showToast.success('Member berhasil dinonaktifkan');
      router.push('/members');
    } catch (error) {
      assertCaughtError(error);
      devError('Delete member error:', error);
      showToast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        'Gagal menghapus member'
      );
    } finally {
      setDeletingMember(false);
    }
  };

  const handleAssignPackage = async () => {
    devLog('=== handleAssignPackage called ===');
    devLog('assignData:', assignData);
    devLog('selectedPackages:', assignData.selectedPackages);
    
    if (assignData.selectedPackages.length === 0) {
      showToast.error('Pilih minimal 1 paket');
      return;
    }

    // Prevent double submission
    if (submitting) {
      devLog('Already submitting, ignoring duplicate request');
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare payload
      const payload: AssignPackageData = {
        packages: assignData.selectedPackages,
        discountPercent: assignData.discountPercent || undefined,
        discountAmount: assignData.discountAmount || undefined,
        discountNote: assignData.discountNote || undefined,
        notes: assignData.notes || undefined,
        paymentPlan: assignData.paymentPlan?.type === 'INSTALLMENT'
          ? {
              type: 'INSTALLMENT',
              installmentCount: assignData.paymentPlan.installmentCount,
            }
          : { type: 'FULL_PAYMENT' },
      };
      
      devLog('Sending payload:', payload);
      
      await packagesApi.assignPackage(memberId, payload);
      showToast.success('Paket berhasil diassign');
      setShowAssignModal(false);
      setAssignData({
        selectedPackages: [],
        selectedAddOns: [],
        discountPercent: 0,
        discountAmount: 0,
        discountNote: '',
        notes: '',
        paymentPlan: {
          type: 'FULL_PAYMENT',
          installmentCount: 2,
        },
      });
      await Promise.all([loadPackages(), loadMemberDetail(false)]);
    } catch (error) {
      assertCaughtError(error);
      devError('Assign package error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal assign paket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignAddOn = async () => {
    if (addOnTransactionData.selectedAddOns.length === 0) {
      showToast.error('Pilih minimal 1 produk Air Nano atau Add-On');
      return;
    }
    if (!addOnTransactionData.transactionDate || !addOnTransactionData.sellerMsoId) {
      showToast.error('Tanggal transaksi dan MSO penjual wajib diisi');
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      await packagesApi.assignPackage(memberId, {
        packages: [],
        addOns: addOnTransactionData.selectedAddOns,
        transactionDate: addOnTransactionData.transactionDate,
        sellerMsoId: addOnTransactionData.sellerMsoId,
        notes: addOnTransactionData.notes || undefined,
        paymentPlan: { type: 'FULL_PAYMENT' },
      });
      showToast.success('Transaksi Air Nano & Add-On berhasil dibuat');
      setShowAddOnModal(false);
      setAddOnTransactionData({
        selectedAddOns: [],
        transactionDate: getJakartaDateInputValue(),
        sellerMsoId: '',
        notes: '',
      });
      await Promise.all([loadPackages(), loadMemberDetail(false)]);
    } catch (error) {
      assertCaughtError(error);
      devError('Assign add-on error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal membuat transaksi Add-On');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaymentVerification = async (
    itemId: string,
    itemStatus: string,
    proofUrl?: string,
    proofFileName?: string,
  ) => {
    setSelectedPackageId(itemId);
    setSelectedPackageProof({
      url: proofUrl || null,
      fileName: proofFileName || null,
      status: itemStatus,
    });
    setVerifyNotes('');
    setVerifyPaidAmount(0);
    setVerifyInvoice(null);
    setPaymentProof({ file: null, preview: null });
    setShowVerifyModal(true);

    try {
      const invoice = await invoiceApi.getInvoiceByPackageId(itemId);
      setVerifyInvoice(invoice);
      if (
        invoice.paymentPlanType === 'INSTALLMENT' &&
        invoice.installmentNumber &&
        invoice.installmentTotal &&
        invoice.installmentNumber >= invoice.installmentTotal
      ) {
        setVerifyPaidAmount(getRemainingInvoiceAmount(invoice));
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Load verification invoice error:', error);
    }
  };

  const handleVerifyPayment = async () => {
    // For WAITING_VERIFICATION, we already have proof, don't need to upload
    // For PENDING_PAYMENT, we need proof to be uploaded
    const hasExistingProof = selectedPackageProof.status === 'WAITING_VERIFICATION' && selectedPackageProof.url;
    const isComplimentary = Boolean(
      verifyInvoice &&
      verifyInvoice.paymentPlanType !== 'INSTALLMENT' &&
      Number(verifyInvoice.totalAmount || verifyInvoice.totalPurchaseAmount || 0) === 0
    );
    
    if (!isComplimentary && !hasExistingProof && !paymentProof.file) {
      showToast.error('Bukti pembayaran wajib diupload');
      return;
    }

    const isFinalInstallment = Boolean(
      verifyInvoice?.paymentPlanType === 'INSTALLMENT' &&
      verifyInvoice.installmentNumber &&
      verifyInvoice.installmentTotal &&
      verifyInvoice.installmentNumber >= verifyInvoice.installmentTotal
    );

    const remainingInvoiceAmount = getRemainingInvoiceAmount(verifyInvoice);

    if (isFinalInstallment && verifyInvoice && verifyPaidAmount !== remainingInvoiceAmount) {
      showToast.error(`Termin terakhir wajib dibayar penuh sebesar Rp ${remainingInvoiceAmount.toLocaleString('id-ID')}`);
      return;
    }

    try {
      setSubmitting(true);
      
      let proofData;
      if (isComplimentary) {
        proofData = {
          notes: verifyNotes || undefined,
        };
      } else if (hasExistingProof) {
        // Use existing proof from member upload
        proofData = {
          notes: verifyNotes || undefined,
          paidAmount: verifyPaidAmount > 0 ? verifyPaidAmount : undefined,
          proofFileUrl: selectedPackageProof.url!,
          proofFileName: selectedPackageProof.fileName || 'payment-proof.jpg',
          proofFileSize: 0, // Not available for existing
          proofMimeType: 'image/jpeg', // Assume JPEG
        };
      } else {
        // Upload new file to MinIO first
        const uploadResult = await packagesApi.uploadPaymentProof(paymentProof.file!);
        proofData = {
          notes: verifyNotes || undefined,
          paidAmount: verifyPaidAmount > 0 ? verifyPaidAmount : undefined,
          proofFileUrl: uploadResult.url,
          proofFileName: uploadResult.fileName,
          proofFileSize: uploadResult.fileSize,
          proofMimeType: uploadResult.mimeType,
        };
      }
      
      // Then verify payment
      await packagesApi.verifyPayment(selectedPackageId, proofData);
      
      showToast.success('Pembayaran berhasil diverifikasi');
      setShowVerifyModal(false);
      setVerifyNotes('');
      setVerifyPaidAmount(0);
      setVerifyInvoice(null);
      setPaymentProof({ file: null, preview: null });
      setSelectedPackageId('');
      setSelectedPackageProof({ url: null, fileName: null, status: 'PENDING_PAYMENT' });
      loadPackages();
    } catch (error) {
      assertCaughtError(error);
      devError('Verify payment error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal verifikasi pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPayment = async (reason: string) => {
    try {
      await packagesApi.rejectPayment(selectedPackageId, { reason });
      showToast.success('Pembayaran berhasil ditolak');
      setShowVerifyModal(false);
      setVerifyNotes('');
      setVerifyPaidAmount(0);
      setVerifyInvoice(null);
      setPaymentProof({ file: null, preview: null });
      setSelectedPackageId('');
      setSelectedPackageProof({ url: null, fileName: null, status: 'PENDING_PAYMENT' });
      loadPackages();
    } catch (error) {
      assertCaughtError(error);
      devError('Reject payment error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menolak pembayaran');
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifMessage) {
      alert('Judul dan pesan wajib diisi');
      return;
    }

    try {
      setSendingNotif(true);
      await sendNotificationApi(memberId, {
        title: notifTitle,
        message: notifMessage,
      });
      alert('Notifikasi berhasil dikirim');
      setShowNotifModal(false);
      setNotifTitle('');
      setNotifMessage('');
    } catch (error) {
      assertCaughtError(error);
      alert('Gagal mengirim notifikasi');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleToggleLifeStatus = async () => {
    if (!member || updatingLifeStatus) return;

    const nextIsDeceased = !member.isDeceased;
    const nextLabel = nextIsDeceased ? 'meninggal' : 'masih hidup';

    if (!confirm(`Ubah status member menjadi ${nextLabel}?`)) {
      return;
    }

    try {
      setUpdatingLifeStatus(true);
      await updateMemberApi(memberId, { isDeceased: nextIsDeceased });
      showToast.success(`Status member berhasil diubah menjadi ${nextLabel}`);
      await loadMemberDetail();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengubah status member');
    } finally {
      setUpdatingLifeStatus(false);
    }
  };

  const handleRefundPackage = async () => {
    if (!refundReason || refundReason.length < 8) {
      showToast.error('Alasan refund minimal 8 karakter');
      return;
    }
    if (refundAmount <= 0) {
      showToast.error('Jumlah refund wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      await packagesApi.refundPackage(selectedPackageId, {
        reason: refundReason,
        refundAmount,
        refundProof: refundProof.file || undefined,
        returnAddOnsToStock,
      });
      showToast.success('Paket berhasil di-refund');
      setShowRefundModal(false);
      setRefundReason('');
      setRefundAmount(0);
      setReturnAddOnsToStock(false);
      setRefundProof({ file: null, preview: null });
      setSelectedPackageId('');
      await Promise.all([loadPackages(), loadMemberDetail(false)]);
    } catch (error) {
      assertCaughtError(error);
      devError('Refund package error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal refund paket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPackage = async () => {
    if (!cancelReason) {
      showToast.error('Alasan pembatalan wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      await packagesApi.cancelPackage(selectedPackageId, {
        reason: cancelReason
      });
      showToast.success('Pembelian berhasil dibatalkan');
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedPackageId('');
      await Promise.all([loadPackages(), loadMemberDetail(false)]);
    } catch (error) {
      assertCaughtError(error);
      devError('Cancel package error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal batalkan pembelian');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for EditPackageModal data changes
  const handleEditDataChange = (data: typeof editData) => {
    setEditData(data);
  };

  const handleAdjustVoucherBalance = async (
    packageId: string,
    remainingSessions: number,
    reason: string,
  ) => {
    await packagesApi.adjustVoucherBalance(packageId, { remainingSessions, reason });
    await loadPackages();
    showToast.success('Saldo voucher berhasil diperbarui');
  };

  const editSubmissionInFlightRef = useRef(false);

  const handleEditPackage = async () => {
    if (editSubmissionInFlightRef.current) {
      return;
    }

    if (editData.selectedPackages.length === 0 && editData.selectedAddOns.length === 0) {
      showToast.error('Pilih minimal 1 paket atau add-on');
      return;
    }

    try {
      editSubmissionInFlightRef.current = true;
      setSubmitting(true);
      
      // Prepare payload similar to assign package
      const payload: EditPackageData = {
        packages: editData.selectedPackages.map((selection) => ({
          pricingId: selection.pricingId,
          quantity: selection.quantity,
        })),
        discountPercent: editData.discountPercent || undefined,
        discountAmount: editData.discountAmount || undefined,
        discountNote: editData.discountNote || undefined,
        notes: editData.notes || undefined
      };
      
      // Add addOns if any selected
      if (editData.selectedAddOns.length > 0) {
        payload.addOns = editData.selectedAddOns;
      }
      
      devLog('=== EDIT PACKAGE DEBUG ===');
      devLog('editingPackageId:', editingPackageId);
      devLog('payload:', payload);
      
      await packagesApi.editPackage(editingPackageId, payload);
      showToast.success('Paket berhasil diupdate');
      setShowEditModal(false);
      setEditData({
        selectedPackages: [],
        selectedAddOns: [],
        discountPercent: 0,
        discountAmount: 0,
        discountNote: '',
        notes: ''
      });
      setEditingPackageId('');
      setEditingPackages([]);
      await Promise.all([loadPackages(), loadMemberDetail(false)]);
    } catch (error) {
      assertCaughtError(error);
      devError('Edit package error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal edit paket');
    } finally {
      editSubmissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    devLog('🔄 [Member Detail] useEffect triggered for memberId:', memberId);
    devLog('👤 [Member Detail] Current user:', user?.email, 'role:', user?.role);
    void loadMemberDetail();
    void loadPackages();
  }, [loadMemberDetail, loadPackages, memberId, user?.email, user?.role]);

  useEffect(() => {
    if (activeTab === 'paket' && canEditPackage && member) {
      const pricingBranchKey = member.registrationBranch?.id || 'NO_BRANCH';
      if (loadedPricingBranchIdRef.current === pricingBranchKey) return;
      if (loadingPricingBranchIdRef.current === pricingBranchKey) return;

      loadingPricingBranchIdRef.current = pricingBranchKey;
      void loadPricings()
        .then((loaded) => {
          if (loaded) loadedPricingBranchIdRef.current = pricingBranchKey;
        })
        .finally(() => {
          if (loadingPricingBranchIdRef.current === pricingBranchKey) {
            loadingPricingBranchIdRef.current = null;
          }
        });
    }
  }, [activeTab, canEditPackage, loadPricings, member]);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Memuat data member...</p>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <>
      <MemberHeader
        member={member}
        onBack={() => router.back()}
        onSendNotification={() => setShowNotifModal(true)}
        onEdit={() => setShowEditMemberModal(true)}
        onDelete={handleDeleteMember}
        onDestroy={() => setShowDestructionModal(true)}
        onManageCredentials={() => setShowCredentialsModal(true)}
        onUploadDocuments={() => setShowUploadModal(true)}
        isSuperAdmin={isSuperAdmin}
        canEdit={canEditMember}
        canDelete={canDeleteMember}
        isDeleting={deletingMember}
        canSendNotification={canSendNotification}
        canUploadDocuments={canUploadDocuments}
        hasDocuments={hasDocuments}
      />

      <MemberStatusCards
        member={member}
        packages={packages}
        canEditVoucher={canPrivilegedEditPackage}
        onEditBasicVoucher={() => setShowBasicVoucherEditModal(true)}
        onEditBoosterVoucher={() => setShowBoosterVoucherEditModal(true)}
      />

      {/* Tabs */}
      <div className="member-detail-tabs-card overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="member-detail-tab-list gap-1 bg-neutral-50 p-2 dark:bg-neutral-950/40" role="tablist" aria-label="Menu detail member">
          {MEMBER_DETAIL_TABS.map((tab) => {
            const tabMeta = MEMBER_DETAIL_TAB_META[tab];
            const TabIcon = tabMeta.icon;
            const isSelected = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`member-tab-${tab}`}
                aria-controls={`member-tab-panel-${tab}`}
                aria-selected={isSelected}
                onClick={() => handleTabChange(tab)}
                className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${
                  isSelected
                    ? 'bg-white text-sky-700 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-sky-300 dark:ring-neutral-700'
                    : 'text-neutral-500 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-white'
                }`}
              >
                <TabIcon size={16} />
                {tabMeta.label}
              </button>
            );
          })}
        </div>

        <div className="member-detail-tab-content">
          {visitedTabs.has('profil') && (
            <section
              id="member-tab-panel-profil"
              role="tabpanel"
              aria-labelledby="member-tab-profil"
              hidden={activeTab !== 'profil'}
            >
              <MemberProfileTab 
                member={member}
                canEditLifeStatus={canEditLifeStatus}
                updatingLifeStatus={updatingLifeStatus}
                onToggleLifeStatus={handleToggleLifeStatus}
              />
            </section>
          )}
          
          {visitedTabs.has('paket') && (
            <section
              id="member-tab-panel-paket"
              role="tabpanel"
              aria-labelledby="member-tab-paket"
              hidden={activeTab !== 'paket'}
            >
              <div className="member-packages-header">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">Keanggotaan</p>
                  <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">Paket Member</h3>
                </div>
                {canAssignPackage && <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenAssignPackage()}
                    disabled={loadingPricings}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black transition hover:bg-amber-400"
                  >
                    {loadingPricings ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                    {loadingPricings ? 'Memuat harga...' : 'Assign Paket'}
                  </button>
                </div>}
              </div>
              <MemberPackagesTab
                packages={packageTransactions}
                loading={loadingPackages}
                hideGroupedAddOns
                onVerifyPayment={canAssignPackage ? handleOpenPaymentVerification : undefined}
                onRefundPackage={canAssignPackage ? (packageId: string, packageCode: string, finalPrice: number) => {
                  setSelectedPackageId(packageId);
                  setRefundPackageCode(packageCode);
                  setRefundFinalPrice(finalPrice);
                  setRefundAmount(finalPrice);
                  setShowRefundModal(true);
                } : undefined}
                onCancelPackage={canAssignPackage ? (packageId: string, packageCode: string) => {
                  setSelectedPackageId(packageId);
                  setCancelPackageCode(packageCode);
                  setShowCancelModal(true);
                } : undefined}
                onViewRefundDetail={(refundData) => {
                  setRefundDetailData(refundData);
                  setShowRefundDetailModal(true);
                }}
                canEditWaitingVerification={canEditWaitingVerificationPackage}
                canEditVerified={canEditVerifiedPackage}
                onEditPackage={canEditPackage ? (purchaseGroupId: string, packages: MemberPackage[], addOns: StandaloneAddOn[], discount: number, discountPercent: number, discountNote: string, notes: string) => {
                  // Load existing package data into edit modal
                  const selectedPackages = buildEditPackageSelections(packages, pricings);
                  
                  const selectedAddOns = addOns.map((addon) => ({
                    type: addon.addOnType as AddOnType,
                    code: addon.addOnCode,
                    name: addon.notes?.split('(')[0]?.trim() || addon.addOnCode,
                    price: Number(addon.pricePerUnit),
                    quantity: addon.quantity
                  }));
                  
                  // Calculate the original price to separate percent discount from amount discount
                  // discount already contains total (percent + amount), we need to separate them
                  let discountAmountOnly = discount;
                  if (discountPercent > 0 && packages.length > 0) {
                    // Calculate total final price for all packages
                    const totalPackagesFinalPrice = packages.reduce((sum, pkg) => sum + Number(pkg.finalPrice || 0), 0);
                    
                    // Calculate total add-ons price
                    const totalAddOnsPrice = addOns.reduce((sum, addon) => sum + (Number(addon.pricePerUnit || 0) * addon.quantity), 0);
                    
                    // Total final price (after discount)
                    const totalFinalPrice = totalPackagesFinalPrice + totalAddOnsPrice;
                    
                    // Original price before discount = final price + total discount
                    const originalPrice = totalFinalPrice + discount;
                    
                    // Calculate what the percent discount was from original price
                    const percentDiscountValue = (originalPrice * discountPercent) / 100;
                    
                    // Subtract percent discount from total to get amount-only discount
                    discountAmountOnly = discount - percentDiscountValue;
                  }

                  setEditingPackageId(purchaseGroupId);
                  setEditingPackages(packages);
                  setEditData({
                    selectedPackages,
                    selectedAddOns,
                    discountPercent: discountPercent,
                    discountAmount: Math.max(0, discountAmountOnly), // Ensure non-negative
                    discountNote: discountNote || '',
                    notes: notes || ''
                  });
                  setShowEditModal(true);
                } : undefined}
              />
            </section>
          )}

          {visitedTabs.has('air-nano-addon') && (
            <section
              id="member-tab-panel-air-nano-addon"
              role="tabpanel"
              aria-labelledby="member-tab-air-nano-addon"
              hidden={activeTab !== 'air-nano-addon'}
            >
              <div className="member-packages-header">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                    Produk Non-Terapi
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                    Air Nano & Add-On
                  </h3>
                </div>
                {canAssignPackage && (
                  <button
                    type="button"
                    onClick={() => void handleOpenAddOnModal()}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black transition hover:bg-amber-400"
                  >
                    <Plus size={16} />
                    Tambah Transaksi
                  </button>
                )}
              </div>
              <MemberAddOnsTab
                addOns={addOnTransactions}
                loading={loadingPackages}
                onVerifyPayment={canAssignPackage ? handleOpenPaymentVerification : undefined}
              />
            </section>
          )}

          {visitedTabs.has('sesi') && (
            <section
              id="member-tab-panel-sesi"
              role="tabpanel"
              aria-labelledby="member-tab-sesi"
              hidden={activeTab !== 'sesi'}
            >
              <MemberSessionsTab
                memberId={memberId}
                memberNo={member.memberNo}
                memberName={member.profile.fullName}
                canCreate={!isAdminManager}
                onDeleted={async () => {
                  await Promise.all([loadPackages(), loadMemberDetail(false)]);
                }}
              />
            </section>
          )}

          {visitedTabs.has('diagnosa') && (
            <section
              id="member-tab-panel-diagnosa"
              role="tabpanel"
              aria-labelledby="member-tab-diagnosa"
              hidden={activeTab !== 'diagnosa'}
            >
              <MemberDiagnosesTab memberId={memberId} memberBranchId={member.registrationBranch?.id} canEdit={canCreateDiagnosis} />
            </section>
          )}
          
          {visitedTabs.has('therapy-plan') && (
            <section
              id="member-tab-panel-therapy-plan"
              role="tabpanel"
              aria-labelledby="member-tab-therapy-plan"
              hidden={activeTab !== 'therapy-plan'}
            >
              <MemberTherapyPlansTab
                memberId={memberId}
                canEdit={['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'].includes(user?.role || '')}
              />
            </section>
          )}
          
          {visitedTabs.has('lab-results') && (
            <section
              id="member-tab-panel-lab-results"
              role="tabpanel"
              aria-labelledby="member-tab-lab-results"
              hidden={activeTab !== 'lab-results'}
            >
              <MemberLabResultsTab memberId={memberId} canEdit={!isAdminManager} />
            </section>
          )}
        </div>
      </div>

      {/* Modals */}
      <SendNotificationModal
        show={showNotifModal}
        title={notifTitle}
        message={notifMessage}
        sending={sendingNotif}
        onClose={() => setShowNotifModal(false)}
        onTitleChange={setNotifTitle}
        onMessageChange={setNotifMessage}
        onSubmit={handleSendNotification}
      />

      <AssignPackageModal
        show={showAssignModal}
        pricings={pricings}
        pricingScopeName={member.registrationBranch?.name}
        assignData={assignData}
        submitting={submitting}
        onClose={() => setShowAssignModal(false)}
        onAssignDataChange={handleAssignDataChange}
        onSubmit={handleAssignPackage}
      />

      <AssignAddOnModal
        show={showAddOnModal}
        branchName={member.registrationBranch?.name}
        msoStaff={msoStaff}
        loadingMsoStaff={loadingMsoStaff}
        data={addOnTransactionData}
        submitting={submitting}
        onChange={setAddOnTransactionData}
        onClose={() => setShowAddOnModal(false)}
        onSubmit={handleAssignAddOn}
      />

      <MemberDestructionModal
        open={showDestructionModal}
        memberId={memberId}
        member={member}
        onClose={() => setShowDestructionModal(false)}
        onDestroyed={() => router.push('/members')}
      />

      <VerifyPaymentModal
        show={showVerifyModal}
        notes={verifyNotes}
        submitting={submitting}
        onClose={() => {
          setShowVerifyModal(false);
          setVerifyNotes('');
          setVerifyPaidAmount(0);
          setVerifyInvoice(null);
          setPaymentProof({ file: null, preview: null });
          setSelectedPackageId('');
          setSelectedPackageProof({ url: null, fileName: null, status: 'PENDING_PAYMENT' });
        }}
        onNotesChange={setVerifyNotes}
        paidAmount={verifyPaidAmount}
        invoice={verifyInvoice}
        onPaidAmountChange={setVerifyPaidAmount}
        onProofChange={setPaymentProof}
        onSubmit={handleVerifyPayment}
        onReject={handleRejectPayment}
        existingProofUrl={selectedPackageProof.url}
        existingProofFileName={selectedPackageProof.fileName}
        packageStatus={selectedPackageProof.status}
      />

      <PackageRefundModal
        show={showRefundModal}
        packageCode={refundPackageCode}
        finalPrice={refundFinalPrice}
        reason={refundReason}
        refundAmount={refundAmount}
        returnAddOnsToStock={returnAddOnsToStock}
        refundProof={refundProof}
        submitting={submitting}
        onClose={() => {
          setShowRefundModal(false);
          setRefundReason('');
          setRefundAmount(0);
          setReturnAddOnsToStock(false);
          setRefundProof({ file: null, preview: null });
          setSelectedPackageId('');
        }}
        onReasonChange={setRefundReason}
        onRefundAmountChange={setRefundAmount}
        onReturnAddOnsToStockChange={setReturnAddOnsToStock}
        onProofChange={setRefundProof}
        onSubmit={handleRefundPackage}
      />

      <PackageCancelModal
        show={showCancelModal}
        packageCode={cancelPackageCode}
        reason={cancelReason}
        submitting={submitting}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
          setSelectedPackageId('');
        }}
        onReasonChange={setCancelReason}
        onSubmit={handleCancelPackage}
      />

      <EditPackageModal
        show={showEditModal}
        pricings={pricings}
        editData={editData}
        existingPackages={editingPackages}
        submitting={submitting}
        onClose={() => {
          setShowEditModal(false);
          setEditData({
            selectedPackages: [],
            selectedAddOns: [],
            discountPercent: 0,
            discountAmount: 0,
            discountNote: '',
            notes: ''
          });
          setEditingPackageId('');
          setEditingPackages([]);
        }}
        onEditDataChange={handleEditDataChange}
        onSubmit={handleEditPackage}
      />

      <VoucherBalanceEditModal
        show={showBasicVoucherEditModal}
        packageType="BASIC"
        packages={getActiveMemberPackagesByType(packages, 'BASIC')}
        onClose={() => setShowBasicVoucherEditModal(false)}
        onSubmit={handleAdjustVoucherBalance}
      />

      <VoucherBalanceEditModal
        show={showBoosterVoucherEditModal}
        packageType="BOOSTER"
        packages={getActiveMemberPackagesByType(packages, 'BOOSTER')}
        onClose={() => setShowBoosterVoucherEditModal(false)}
        onSubmit={handleAdjustVoucherBalance}
      />

      {refundDetailData && (
        <RefundDetailModal
          isOpen={showRefundDetailModal}
          onClose={() => {
            setShowRefundDetailModal(false);
            setRefundDetailData(null);
          }}
          refundData={refundDetailData}
        />
      )}

      {/* Member Credentials Modal (Super Admin Only) */}
      <MemberCredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        memberId={memberId}
        memberName={member.profile.fullName}
        onSuccess={() => loadMemberDetail()}
      />

      {/* Upload Documents Modal */}
      <UploadDocumentsModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        memberId={memberId}
        memberName={member.profile.fullName}
        onSuccess={() => loadMemberDetail()}
        hasDocuments={hasDocuments}
      />

      {/* Edit Member Modal */}
      {showEditMemberModal && (
        <MemberEditModal
          isOpen={showEditMemberModal}
          onClose={() => setShowEditMemberModal(false)}
          action="edit"
          branchId={member.registrationBranch?.id || ''}
          memberId={memberId}
          memberData={member}
          userRole={user?.role}
          onSuccess={() => {
            setShowEditMemberModal(false);
            loadMemberDetail();
          }}
        />
      )}
    </>
  );
}
