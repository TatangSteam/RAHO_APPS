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

  // Handler for AssignPackageModal data changes
  const handleAssignDataChange = (data: typeof assignData) => {
    setAssignData(data);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
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
      const data = await getMemberDetailApi(memberId);
      setMember(data);
    } catch (error) {
      console.error('Failed to load member detail:', error);
      alert('Gagal memuat detail member');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      console.log('=== Loading packages for member:', memberId);
      const data = await packagesApi.getMemberPackages(memberId);
      console.log('Loaded packages data:', data);
      console.log('Packages array:', data.packages);
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Failed to load packages:', error);
      showToast.error('Gagal memuat data paket');
    } finally {
      setLoadingPackages(false);
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
          {activeTab === 'profil' && <MemberProfileTab member={member} />}
          
          {activeTab === 'paket' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>📦 Paket Member</h3>
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary">
                  ➕ Assign Paket
                </button>
              </div>
              <MemberPackagesTab
                packages={packages}
                loading={loadingPackages}
                onVerifyPayment={(packageId: string) => {
                  setSelectedPackageId(packageId);
                  setShowVerifyModal(true);
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

          {activeTab === 'diagnosa' && <MemberDiagnosesTab memberId={memberId} />}
          
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
    </>
  );
}
