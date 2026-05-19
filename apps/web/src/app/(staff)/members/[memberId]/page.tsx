'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getMemberDetailApi, sendNotificationApi } from '@/lib/membersApi';
import { packagesApi } from '@/lib/packagesApi';
import type { MemberDetail } from '@/types/member';
import type { PackageDisplay, PackagePricing, ExtendedBoosterType, ServiceType, AddOnType } from '@/types/package';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';

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

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberId as string;
  const { user } = useAuthStore();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profil' | 'paket' | 'sesi' | 'diagnosa' | 'therapy-plan'>('profil');
  
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
    notes: ''
  });
  const [verifyNotes, setVerifyNotes] = useState('');
  const [paymentProof, setPaymentProof] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null });
  const [submitting, setSubmitting] = useState(false);

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

  // Handler for AssignPackageModal data changes
  const handleAssignDataChange = (data: typeof assignData) => {
    setAssignData(data);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canAssignPackage = !['DOCTOR', 'NURSE'].includes(user?.role || '');

  useEffect(() => {
    console.log('🔄 [Member Detail] useEffect triggered for memberId:', memberId);
    console.log('👤 [Member Detail] Current user:', user?.email, 'role:', user?.role);
    loadMemberDetail();
    loadPackages();
  }, [memberId]);

  useEffect(() => {
    if (activeTab === 'paket') {
      loadPricings();
    }
  }, [activeTab]);

  const loadMemberDetail = async () => {
    try {
      setLoading(true);
      console.log('📥 [Member Detail] Loading member detail for:', memberId);
      const startTime = performance.now();
      
      const data = await getMemberDetailApi(memberId);
      
      const endTime = performance.now();
      console.log(`⏱️ [Member Detail] loadMemberDetail: ${(endTime - startTime).toFixed(2)}ms`);
      console.log('✅ [Member Detail] Member data loaded:', data.memberNo, data.profile.fullName);
      setMember(data);
    } catch (error: any) {
      console.error('❌ [Member Detail] Failed to load member detail:', error);
      console.error('❌ [Member Detail] Error response:', error.response?.data);
      console.error('❌ [Member Detail] Error status:', error.response?.status);
      alert('Gagal memuat detail member: ' + (error.response?.data?.error?.message || error.message));
      router.back();
    } finally {
      setLoading(false);
      console.log('🏁 [Member Detail] Loading finished');
    }
  };

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      console.log('📦 [Member Detail] Loading packages for member:', memberId);
      const startTime = performance.now();
      
      const data = await packagesApi.getMemberPackages(memberId);
      
      const endTime = performance.now();
      console.log(`⏱️ [Member Detail] loadPackages: ${(endTime - startTime).toFixed(2)}ms`);
      console.log('📥 [Member Detail] Raw API response:', JSON.stringify(data, null, 2));
      console.log('✅ [Member Detail] Packages loaded:', data.packages?.length || 0, 'packages');
      setPackages(data.packages || []);
    } catch (error: any) {
      console.error('❌ [Member Detail] Failed to load packages:', error);
      console.error('❌ [Member Detail] Error response:', error.response?.data);
      showToast.error('Gagal memuat data paket: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setLoadingPackages(false);
      console.log('🏁 [Member Detail] Package loading finished');
    }
  };

  const loadPricings = async () => {
    try {
      // Fetch actual pricing from backend
      const data = await packagesApi.getPackagePricings();
      console.log('Loaded pricings:', data);
      setPricings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load pricings:', error);
      showToast.error('Gagal memuat harga paket');
      // Set empty array as fallback
      setPricings([]);
    }
  };

  const handleAssignPackage = async () => {
    console.log('=== handleAssignPackage called ===');
    console.log('assignData:', JSON.stringify(assignData, null, 2));
    console.log('selectedPackages:', assignData.selectedPackages);
    assignData.selectedPackages.forEach((pkg, idx) => {
      console.log(`  Package ${idx}: pricingId=${pkg.pricingId}, quantity=${pkg.quantity}`);
    });
    
    if (assignData.selectedPackages.length === 0 && assignData.selectedAddOns.length === 0) {
      showToast.error('Pilih minimal 1 paket atau add-on');
      return;
    }

    // Prevent double submission
    if (submitting) {
      console.log('Already submitting, ignoring duplicate request');
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
        notes: assignData.notes || undefined
      };
      
      // Add addOns if any selected
      if (assignData.selectedAddOns.length > 0) {
        payload.addOns = assignData.selectedAddOns;
      }
      
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      
      await packagesApi.assignPackage(memberId, payload);
      showToast.success('Paket berhasil diassign');
      setShowAssignModal(false);
      setAssignData({
        selectedPackages: [],
        selectedAddOns: [],
        discountPercent: 0,
        discountAmount: 0,
        discountNote: '',
        notes: ''
      });
      await loadPackages();
    } catch (error: any) {
      console.error('Assign package error:', error);
      console.error('Error response:', error.response?.data);
      showToast.error(error.response?.data?.error?.message || 'Gagal assign paket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async () => {
    // Validate payment proof
    if (!paymentProof.file) {
      showToast.error('Bukti pembayaran wajib diupload');
      return;
    }

    try {
      setSubmitting(true);
      
      // Upload file to MinIO first
      const uploadResult = await packagesApi.uploadPaymentProof(paymentProof.file);
      
      // Then verify payment with the uploaded file URL
      await packagesApi.verifyPayment(selectedPackageId, {
        notes: verifyNotes || undefined,
        proofFileUrl: uploadResult.url,
        proofFileName: uploadResult.fileName,
        proofFileSize: uploadResult.fileSize,
        proofMimeType: uploadResult.mimeType,
      });
      
      showToast.success('Pembayaran berhasil diverifikasi');
      setShowVerifyModal(false);
      setVerifyNotes('');
      setPaymentProof({ file: null, preview: null });
      setSelectedPackageId('');
      loadPackages();
    } catch (error: any) {
      console.error('Verify payment error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal verifikasi pembayaran');
    } finally {
      setSubmitting(false);
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
      console.error('Refund package error:', error);
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
      console.error('Cancel package error:', error);
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
      
      console.log('=== EDIT PACKAGE DEBUG ===');
      console.log('editingPackageId:', editingPackageId);
      console.log('payload:', JSON.stringify(payload, null, 2));
      console.log('editData.selectedPackages:', editData.selectedPackages);
      
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
      console.error('Edit package error:', error);
      console.error('Error response:', error.response?.data);
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
        onEdit={() => router.push(`/members/${memberId}/edit`)}
        isSuperAdmin={isSuperAdmin}
      />

      <MemberStatusCards member={member} packages={packages} />

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--surface-border)', display: 'flex', overflowX: 'auto' }}>
          {(['profil', 'paket', 'sesi', 'diagnosa', 'therapy-plan'] as const).map((tab) => (
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
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {activeTab === 'profil' && (
            <>
  
              <MemberProfileTab 
                member={member}
              />
            </>
          )}
          
          {activeTab === 'paket' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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
                onVerifyPayment={(packageId: string) => {
                  setSelectedPackageId(packageId);
                  setShowVerifyModal(true);
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
                onEditPackage={(purchaseGroupId: string, packages: any[], addOns: any[], discount: number, discountPercent: number, discountNote: string, notes: string) => {
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
                }}
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

          {activeTab === 'diagnosa' && <MemberDiagnosesTab memberId={memberId} memberBranchId={member.registrationBranch?.id} />}
          
          {activeTab === 'therapy-plan' && <MemberTherapyPlansTab memberId={memberId} />}
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
          setPaymentProof({ file: null, preview: null });
          setSelectedPackageId('');
        }}
        onNotesChange={setVerifyNotes}
        onProofChange={setPaymentProof}
        onSubmit={handleVerifyPayment}
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
    </>
  );
}
