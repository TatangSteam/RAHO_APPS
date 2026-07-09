'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { deleteMemberApi, getMemberDetailApi, sendNotificationApi, updateMemberApi } from '@/lib/membersApi';
import { packagesApi } from '@/lib/packagesApi';
import { invoiceApi } from '@/lib/invoiceApi';
import type { MemberDetail } from '@/types/member';
import type { PackageDisplay, PackagePricing, ExtendedBoosterType, ServiceType, AddOnType } from '@/types/package';
import type { Invoice } from '@/types/invoice';
import {
  hasRole,
  MANAGER_ABOVE_ROLES,
  PACKAGE_MANAGEMENT_ROLES,
  PACKAGE_WAITING_VERIFICATION_EDIT_ROLES,
} from '@/types/auth';
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

type MemberDetailTab = 'profil' | 'paket' | 'sesi' | 'diagnosa' | 'therapy-plan' | 'lab-results';

const MEMBER_DETAIL_TABS: MemberDetailTab[] = ['profil', 'paket', 'therapy-plan', 'diagnosa', 'sesi', 'lab-results'];

function isMemberDetailTab(value: string | null): value is MemberDetailTab {
  return Boolean(value && MEMBER_DETAIL_TABS.includes(value as MemberDetailTab));
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
    setAssignData({ ...data, selectedAddOns: [] });
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canDeleteMember = !!user && hasRole(user.role, MANAGER_ABOVE_ROLES);
  const canAssignPackage = !['DOCTOR', 'NURSE'].includes(user?.role || '');
  const canEditPackage = !!user && hasRole(user.role, PACKAGE_MANAGEMENT_ROLES);
  const canEditWaitingVerificationPackage = !!user && hasRole(user.role, PACKAGE_WAITING_VERIFICATION_EDIT_ROLES);
  const canUploadDocuments = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
  const canEditLifeStatus = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
  const canEditDiagnosis = [
    'DOCTOR',
    'NURSE',
    'ADMIN_LAYANAN',
    'ADMIN_CABANG',
    'ADMIN_MANAGER',
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
    devLog('🔄 [Member Detail] useEffect triggered for memberId:', memberId);
    devLog('👤 [Member Detail] Current user:', user?.email, 'role:', user?.role);
    loadMemberDetail();
    loadPackages();
  }, [memberId]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (isMemberDetailTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    // Only load pricings for roles that can assign packages
    // Reload when member data is available (to get the correct branchId)
    if (activeTab === 'paket' && canAssignPackage && member) {
      loadPricings();
    }
  }, [activeTab, canAssignPackage, member]);

  const loadMemberDetail = async () => {
    try {
      setLoading(true);
      devLog('📥 [Member Detail] Loading member detail for:', memberId);
      const startTime = performance.now();
      
      const data = await getMemberDetailApi(memberId);
      
      const endTime = performance.now();
      devLog(`⏱️ [Member Detail] loadMemberDetail: ${(endTime - startTime).toFixed(2)}ms`);
      devLog('✅ [Member Detail] Member data loaded:', data.memberNo, data.profile.fullName);
      setMember(data);
    } catch (error: any) {
      devError('❌ [Member Detail] Failed to load member detail:', error);
      devError('❌ [Member Detail] Error response:', error.response?.data);
      devError('❌ [Member Detail] Error status:', error.response?.status);
      alert('Gagal memuat detail member: ' + (error.response?.data?.error?.message || error.message));
      router.back();
    } finally {
      setLoading(false);
      devLog('🏁 [Member Detail] Loading finished');
    }
  };

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      devLog('📦 [Member Detail] Loading packages for member:', memberId);
      const startTime = performance.now();
      
      const data = await packagesApi.getMemberPackages(memberId);
      
      const endTime = performance.now();
      devLog(`⏱️ [Member Detail] loadPackages: ${(endTime - startTime).toFixed(2)}ms`);
      devLog('✅ [Member Detail] Packages loaded:', data.packages?.length || 0, 'packages');
      setPackages(data.packages || []);
    } catch (error: any) {
      devError('❌ [Member Detail] Failed to load packages:', error);
      showToast.error('Gagal memuat data paket: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setLoadingPackages(false);
      devLog('🏁 [Member Detail] Package loading finished');
    }
  };

  const loadPricings = async () => {
    try {
      // Fetch actual pricing from backend
      // Pass member's registration branch to get correct pricing
      const memberBranchId = member?.registrationBranch?.id;
      devLog('Loading pricings for member branch:', memberBranchId);
      const data = await packagesApi.getPackagePricings(memberBranchId);
      devLog('Loaded pricings:', data);
      setPricings(Array.isArray(data) ? data : []);
    } catch (error) {
      devError('Failed to load pricings:', error);
      showToast.error('Gagal memuat harga paket');
      // Set empty array as fallback
      setPricings([]);
    }
  };

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
    } catch (error: any) {
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
      const payload: any = {
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
      await loadPackages();
    } catch (error: any) {
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
    
    if (!hasExistingProof && !paymentProof.file) {
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
      if (hasExistingProof) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
        refundProof: refundProof.file || undefined
      });
      showToast.success('Paket berhasil di-refund');
      setShowRefundModal(false);
      setRefundReason('');
      setRefundAmount(0);
      setRefundProof({ file: null, preview: null });
      setSelectedPackageId('');
      await loadPackages();
    } catch (error: any) {
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
      await loadPackages();
    } catch (error: any) {
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

  const handleEditPackage = async () => {
    if (editData.selectedPackages.length === 0 && editData.selectedAddOns.length === 0) {
      showToast.error('Pilih minimal 1 paket atau add-on');
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare payload similar to assign package
      const payload: any = {
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
      await loadPackages();
    } catch (error: any) {
      devError('Edit package error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal edit paket');
    } finally {
      setSubmitting(false);
    }
  };

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
        canDelete={canDeleteMember}
        isDeleting={deletingMember}
        canUploadDocuments={canUploadDocuments}
        hasDocuments={hasDocuments}
      />

      <MemberStatusCards member={member} packages={packages} />

      {/* Tabs */}
      <div className="card member-detail-tabs-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="member-detail-tab-list">
          {MEMBER_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--color-primary-500)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? '600' : '500',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab === 'profil' && '👤 Profil'}
              {tab === 'paket' && '📦 Paket'}
              {tab === 'sesi' && '🩺 Sesi Terapi'}
              {tab === 'diagnosa' && '📋 Diagnosa'}
              {tab === 'therapy-plan' && '💊 Therapy Plan'}
              {tab === 'lab-results' && '🔬 Hasil Lab'}
            </button>
          ))}
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
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>📦 Paket Member</h3>
                {canAssignPackage && (
                  <button onClick={() => setShowAssignModal(true)} className="btn btn-primary">
                    ➕ Assign Paket
                  </button>
                )}
              </div>
              <MemberPackagesTab
                packages={packages}
                loading={loadingPackages}
                onVerifyPayment={async (packageId: string, packageStatus: string, proofUrl?: string, proofFileName?: string) => {
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
                    devError('Load verification invoice error:', error);
                  }
                }}
                onRefundPackage={(packageId: string, packageCode: string, finalPrice: number) => {
                  setSelectedPackageId(packageId);
                  setRefundPackageCode(packageCode);
                  setRefundFinalPrice(finalPrice);
                  setRefundAmount(finalPrice);
                  setShowRefundModal(true);
                }}
                onCancelPackage={(packageId: string, packageCode: string) => {
                  setSelectedPackageId(packageId);
                  setCancelPackageCode(packageCode);
                  setShowCancelModal(true);
                }}
                onViewRefundDetail={(refundData) => {
                  setRefundDetailData(refundData);
                  setShowRefundDetailModal(true);
                }}
                canEditWaitingVerification={canEditWaitingVerificationPackage}
                onEditPackage={canEditPackage ? (purchaseGroupId: string, packages: any[], addOns: any[], discount: number, discountPercent: number, discountNote: string, notes: string) => {
                  // Load existing package data into edit modal
                  const selectedPackages = packages.map((pkg: any) => ({
                    pricingId: pkg.packagePricingId || '',
                    quantity: pkg.purchaseQuantity || 1, // Use calculated quantity
                    boosterType: pkg.boosterType as ExtendedBoosterType,
                    serviceType: pkg.serviceType as ServiceType
                  })).filter((p: any) => p.pricingId); // Only include packages with pricingId
                  
                  const selectedAddOns = addOns.map((addon: any) => ({
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
                    const totalPackagesFinalPrice = packages.reduce((sum: number, pkg: any) => sum + Number(pkg.finalPrice || 0), 0);
                    
                    // Calculate total add-ons price
                    const totalAddOnsPrice = addOns.reduce((sum: number, addon: any) => sum + (Number(addon.pricePerUnit || 0) * addon.quantity), 0);
                    
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
            />
          )}

          {activeTab === 'diagnosa' && <MemberDiagnosesTab memberId={memberId} memberBranchId={member.registrationBranch?.id} canEdit={canEditDiagnosis} />}
          
          {activeTab === 'therapy-plan' && <MemberTherapyPlansTab memberId={memberId} />}
          
          {activeTab === 'lab-results' && <MemberLabResultsTab memberId={memberId} />}
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
        refundProof={refundProof}
        submitting={submitting}
        onClose={() => {
          setShowRefundModal(false);
          setRefundReason('');
          setRefundAmount(0);
          setRefundProof({ file: null, preview: null });
          setSelectedPackageId('');
        }}
        onReasonChange={setRefundReason}
        onRefundAmountChange={setRefundAmount}
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
          onSuccess={() => {
            setShowEditMemberModal(false);
            loadMemberDetail();
          }}
        />
      )}
    </>
  );
}
