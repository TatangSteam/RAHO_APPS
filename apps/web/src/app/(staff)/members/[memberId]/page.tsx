'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { deleteMemberApi, getMemberDetailApi, sendNotificationApi, updateMemberApi } from '@/lib/membersApi';
import { packagesApi, type AssignPackageData, type EditPackageData } from '@/lib/packagesApi';
import { invoiceApi } from '@/lib/invoiceApi';
import type { MemberDetail } from '@/types/member';
import type { PackageDisplay, PackagePricing, ExtendedBoosterType, ServiceType, AddOnType, MemberPackage, StandaloneAddOn } from '@/types/package';
import type { Invoice } from '@/types/invoice';
import { useAuthStore } from '@/stores/authStore';
import { confirm as confirmDialog, showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';

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
import VerifyPaymentModal from '@/components/members/VerifyPaymentModal';
import PackageRefundModal from '@/components/members/PackageRefundModal';
import PackageCancelModal from '@/components/members/PackageCancelModal';
import EditPackageModal from '@/components/members/EditPackageModal';
import RefundDetailModal from '@/components/members/RefundDetailModal';
import MemberCredentialsModal from '@/components/members/MemberCredentialsModal';
import UploadDocumentsModal from '@/components/members/UploadDocumentsModal';
import MemberLabResultsTab from '@/components/members/MemberLabResultsTab';
import MemberEditModal from '@/components/members/MemberEditModal';
import {
  ClipboardList,
  FlaskConical,
  Package,
  Pill,
  Plus,
  Stethoscope,
  UserRound,
} from 'lucide-react';

type MemberDetailTab = 'profil' | 'paket' | 'sesi' | 'diagnosa' | 'therapy-plan' | 'lab-results';

const MEMBER_DETAIL_TABS: MemberDetailTab[] = ['profil', 'paket', 'therapy-plan', 'diagnosa', 'sesi', 'lab-results'];

const MEMBER_DETAIL_TAB_META: Record<MemberDetailTab, {
  label: string;
  icon: typeof UserRound;
}> = {
  profil: { label: 'Profil', icon: UserRound },
  paket: { label: 'Paket', icon: Package },
  sesi: { label: 'Sesi Terapi', icon: Stethoscope },
  diagnosa: { label: 'Diagnosis', icon: ClipboardList },
  'therapy-plan': { label: 'Therapy Plan', icon: Pill },
  'lab-results': { label: 'Hasil Lab', icon: FlaskConical },
};

function isMemberDetailTab(value: string | null): value is MemberDetailTab {
  return Boolean(value && MEMBER_DETAIL_TABS.includes(value as MemberDetailTab));
}

function getBoosterTypeFromProductCode(productCode?: string | null): ExtendedBoosterType | undefined {
  const match = productCode?.match(/^BST-([^-]+)-/);
  return match?.[1] as ExtendedBoosterType | undefined;
}

function getServiceTypeFromProductCode(productCode?: string | null): ServiceType | undefined {
  const parts = productCode?.split('-') || [];
  const serviceCode = parts[0] === 'BST' ? parts[3] : parts[2];
  return serviceCode as ServiceType | undefined;
}

function resolvePackagePricing(pkg: MemberPackage, pricings: PackagePricing[]): PackagePricing | undefined {
  if (pkg.productCode) {
    const productCodeMatch = pricings.find((pricing) => pricing.productCode === pkg.productCode);
    if (productCodeMatch) return productCodeMatch;
  }

  const boosterType = getBoosterTypeFromProductCode(pkg.productCode) || pkg.boosterType;
  const serviceType = getServiceTypeFromProductCode(pkg.productCode) || pkg.serviceType;

  if (pkg.packageType === 'BOOSTER' && boosterType) {
    const boosterMatch = pricings.find((pricing) =>
      pricing.packageType === 'BOOSTER' &&
      pricing.boosterType === boosterType &&
      (!serviceType || pricing.serviceType === serviceType)
    );
    if (boosterMatch) return boosterMatch;
  }

  if (pkg.packageType === 'BASIC') {
    const basicMatch = pricings.find((pricing) =>
      pricing.packageType === 'BASIC' &&
      (!serviceType || pricing.serviceType === serviceType) &&
      (pricing.totalSessions === pkg.baseSessions || pricing.totalSessions === pkg.totalSessions)
    );
    if (basicMatch) return basicMatch;
  }

  return pricings.find((pricing) => pricing.id === pkg.packagePricingId);
}

function buildEditPackageSelections(packages: MemberPackage[], pricings: PackagePricing[]) {
  const selections = new Map<string, {
    pricingId: string;
    quantity: number;
    boosterType?: ExtendedBoosterType;
    serviceType?: ServiceType;
  }>();

  packages.forEach((pkg) => {
    const pricing = resolvePackagePricing(pkg, pricings);
    const pricingId = pricing?.id || pkg.packagePricingId || '';
    if (!pricingId) return;

    const boosterType = (getBoosterTypeFromProductCode(pkg.productCode) || pricing?.boosterType || pkg.boosterType) as ExtendedBoosterType | undefined;
    const serviceType = (getServiceTypeFromProductCode(pkg.productCode) || pricing?.serviceType || pkg.serviceType) as ServiceType | undefined;
    const quantity = Number(pkg.purchaseQuantity || 1);
    const key = [pricingId, boosterType || '', serviceType || ''].join('|');
    const existing = selections.get(key);

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    selections.set(key, {
      pricingId,
      quantity,
      boosterType,
      serviceType,
    });
  });

  return Array.from(selections.values());
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const memberId = params.memberId as string;
  const { user } = useAuthStore();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MemberDetailTab>('profil');
  
  // Notification modal state
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Package state
  const [packages, setPackages] = useState<PackageDisplay[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
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
  const canEditPackage = canAssignPackage;
  const canEditWaitingVerificationPackage = isSuperAdmin;
  const canEditVerifiedPackage = isSuperAdmin;
  const canUploadDocuments = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN'].includes(user?.role || '');
  const canEditLifeStatus = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN'].includes(user?.role || '');
  const canEditDiagnosis = [
    'DOCTOR',
    'NURSE',
    'ADMIN_LAYANAN',
    'ADMIN_CABANG',
    'SUPER_ADMIN',
  ].includes(user?.role || '');
  
  // Check if member has any documents (PSP or Profile Photo)
  const hasDocuments = member ? (
    member.documents?.some(doc => 
      doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN' || 
      doc.documentType === 'FOTO_PROFIL'
    ) || false
  ) : false;

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (isMemberDetailTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

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
      // Fetch actual pricing from backend
      // Pass member's registration branch to get correct pricing
      const memberBranchId = member?.registrationBranch?.id;
      devLog('Loading pricings for member branch:', memberBranchId);
      const data = await packagesApi.getPackagePricings(memberBranchId);
      devLog('Loaded pricings:', data);
      setPricings(Array.isArray(data) ? data : []);
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load pricings:', error);
      showToast.error('Gagal memuat harga paket');
      // Set empty array as fallback
      setPricings([]);
    }
  }, [member?.registrationBranch?.id]);

  const handleDeleteMember = async () => {
    if (!member || !canDeleteMember || deletingMember) return;

    const memberName = member.profile?.fullName || member.memberNo || 'member ini';
    const confirmed = await confirmDialog.delete(memberName);
    if (!confirmed) return;

    try {
      setDeletingMember(true);
      await deleteMemberApi(memberId);
      showToast.success('Member berhasil dihapus');
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
    
    if (assignData.selectedPackages.length === 0 && assignData.selectedAddOns.length === 0) {
      showToast.error('Pilih minimal 1 paket atau add-on');
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
        addOns: assignData.selectedAddOns.length > 0 ? assignData.selectedAddOns : undefined,
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
      showToast.success('Paket / add-on berhasil diassign');
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
        packages: editData.selectedPackages,
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
    if (activeTab === 'paket' && canAssignPackage && member) {
      void loadPricings();
    }
  }, [activeTab, canAssignPackage, loadPricings, member]);

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

      <MemberStatusCards member={member} packages={packages} />

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
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
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
          {activeTab === 'profil' && (
            <>
  
              <MemberProfileTab 
                member={member}
                canEditLifeStatus={canEditLifeStatus}
                updatingLifeStatus={updatingLifeStatus}
                onToggleLifeStatus={handleToggleLifeStatus}
              />
            </>
          )}
          
          {activeTab === 'paket' && (
            <div>
              <div className="member-packages-header">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">Keanggotaan</p>
                  <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">Paket Member</h3>
                </div>
                {canAssignPackage && (
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black transition hover:bg-amber-400"
                  >
                    <Plus size={16} />
                    Assign Paket
                  </button>
                )}
              </div>
              <MemberPackagesTab
                packages={packages}
                loading={loadingPackages}
                onVerifyPayment={canAssignPackage ? async (packageId: string, packageStatus: string, proofUrl?: string, proofFileName?: string) => {
                  setSelectedPackageId(packageId);
                  setSelectedPackageProof({
                    url: proofUrl || null,
                    fileName: proofFileName || null,
                    status: packageStatus
                  });
                  // Reset state before opening modal
                  setVerifyNotes('');
                  setVerifyPaidAmount(0);
                  setVerifyInvoice(null);
                  setPaymentProof({ file: null, preview: null });
                  setShowVerifyModal(true);
                  try {
                    const invoice = await invoiceApi.getInvoiceByPackageId(packageId);
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
                } : undefined}
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
            </div>
          )}

          {activeTab === 'sesi' && (
            <MemberSessionsTab
              memberId={memberId}
              memberNo={member.memberNo}
              memberName={member.profile.fullName}
              canCreate={!isAdminManager}
            />
          )}

          {activeTab === 'diagnosa' && <MemberDiagnosesTab memberId={memberId} memberBranchId={member.registrationBranch?.id} canEdit={canEditDiagnosis} />}
          
          {activeTab === 'therapy-plan' && <MemberTherapyPlansTab memberId={memberId} canEdit={!isAdminManager} />}
          
          {activeTab === 'lab-results' && <MemberLabResultsTab memberId={memberId} canEdit={!isAdminManager} />}
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
        assignData={assignData}
        submitting={submitting}
        onClose={() => setShowAssignModal(false)}
        onAssignDataChange={handleAssignDataChange}
        onSubmit={handleAssignPackage}
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
        }}
        onEditDataChange={handleEditDataChange}
        onSubmit={handleEditPackage}
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
