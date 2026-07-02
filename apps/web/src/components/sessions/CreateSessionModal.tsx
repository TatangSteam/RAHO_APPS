'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Package, Stethoscope, Calendar, MapPin, AlertTriangle, CheckCircle2, RefreshCw, FileText, Info, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { sessionApi } from '@/lib/sessionApi';
import { memberApi } from '@/lib/memberApi';
import { diagnosisApi } from '@/lib/diagnosisApi';
import { therapyPlanApi, type TherapyPlan } from '@/lib/therapyPlanApi';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { useAuthStore } from '@/stores/authStore';
import type { CreateSessionInput, SessionType, Diagnosis, SessionDetail } from '@/types/session';
import type { MemberPackage } from '@/types/member';
import { showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';
import TherapyPlanListTable from '@/components/therapy-plan/TherapyPlanListTable';
import {
  DEBT_SESSION_LIMIT,
  getDebtRemainingSessions,
  isDebtEligiblePackage,
  isDebtPackageStatus,
  isPackageUsableForSession,
} from './sessionPackageEligibility';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  preselectedMemberId?: string;
}

export default function CreateSessionModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedMemberId,
}: CreateSessionModalProps) {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [memberId, setMemberId] = useState(preselectedMemberId || '');
  const [memberNo, setMemberNo] = useState('');
  const [memberName, setMemberName] = useState('');
  const [sessionBranchId, setSessionBranchId] = useState(user?.branchId || '');
  const [voucherCount, setVoucherCount] = useState(0);
  const [outstandingDebtSessions, setOutstandingDebtSessions] = useState(0);
  
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [useBooster, setUseBooster] = useState(false);
  const [selectedBoosterPackageId, setSelectedBoosterPackageId] = useState('');
  
  const [therapyPlans, setTherapyPlans] = useState<TherapyPlan[]>([]);
  const [selectedTherapyPlanId, setSelectedTherapyPlanId] = useState('');
  const [loadingTherapyPlans, setLoadingTherapyPlans] = useState(false);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
  const [hasDiagnosis, setHasDiagnosis] = useState(false);
  
  const [adminLayananList, setAdminLayananList] = useState<StaffMember[]>([]);
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [nurses, setNurses] = useState<StaffMember[]>([]);
  const [selectedAdminLayananId, setSelectedAdminLayananId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedNurseId, setSelectedNurseId] = useState('');
  
  const [treatmentDate, setTreatmentDate] = useState('');
  const [pelaksanaan, setPelaksanaan] = useState<SessionType>('ON_SITE');
  const [activeTab, setActiveTab] = useState<'form' | 'therapyPlan'>('form');

  // Manual session numbering
  const [useManualNumbering, setUseManualNumbering] = useState(false);
  const [manualInfusKe, setManualInfusKe] = useState<number | ''>(''); // Global
  const [manualBranchInfusKe, setManualBranchInfusKe] = useState<number | ''>(''); // Branch
  const [calculatedGlobalInfusKe, setCalculatedGlobalInfusKe] = useState<number | null>(null);
  const [calculatedBranchInfusKe, setCalculatedBranchInfusKe] = useState<number | null>(null);

  // Infus Set stock validation
  const [infusSetStock, setInfusSetStock] = useState<number | null>(null);
  const [loadingInfusSetStock, setLoadingInfusSetStock] = useState(false);
  const [infusSetProductName, setInfusSetProductName] = useState('Infus Set + Pelengkap');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (memberId) {
      loadMemberData(memberId);
      loadTherapyPlans(memberId);
      loadDiagnoses(memberId);
    }
  }, [memberId, user?.branchId]);

  useEffect(() => {
    const targetBranchId = sessionBranchId || user?.branchId;
    if (memberId && targetBranchId) {
      loadSuggestedSessionNumbers(memberId, targetBranchId);
    }
  }, [memberId, sessionBranchId, user?.branchId]);

  useEffect(() => {
    setSelectedAdminLayananId('');
    setSelectedDoctorId('');
    setSelectedNurseId('');
  }, [sessionBranchId]);

  useEffect(() => {
    const selectedPkg = packages.find((pkg) => pkg.packageId === selectedPackageId);
    const nextBranchId = selectedPkg?.branchId || sessionBranchId || user?.branchId || '';
    if (nextBranchId && nextBranchId !== sessionBranchId) {
      setSessionBranchId(nextBranchId);
    }
  }, [packages, selectedPackageId, sessionBranchId, user?.branchId]);

  useEffect(() => {
    const targetInfusKe = useManualNumbering && manualInfusKe ? Number(manualInfusKe) : calculatedGlobalInfusKe;
    if (!therapyPlans.length || !targetInfusKe) return;
    const planForSessionNumber = therapyPlans.find((plan) => plan.planNumber === targetInfusKe);
    if (planForSessionNumber) {
      setSelectedTherapyPlanId(planForSessionNumber.id);
    } else {
      setSelectedTherapyPlanId('');
    }
  }, [therapyPlans, calculatedGlobalInfusKe, useManualNumbering, manualInfusKe]);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTreatmentDate(localDateTime);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const targetBranchId = sessionBranchId || user?.branchId || undefined;
    const globalRoleNeedsBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

    if (!targetBranchId && globalRoleNeedsBranch) {
      setAdminLayananList([]);
      setDoctors([]);
      setNurses([]);
      setInfusSetStock(null);
      return;
    }

    loadStaff(targetBranchId);
    if (targetBranchId) {
      loadInfusSetStock(targetBranchId);
    } else {
      setInfusSetStock(null);
    }
  }, [isOpen, sessionBranchId, user?.branchId, user?.role]);

  // Helper to get set key (matching MemberTherapyPlansTab logic)
  const getPlanSetKey = (plan: TherapyPlan): string => {
    return plan.therapyPlanSetId || `${plan.setName || 'legacy'}-${plan.setVersion || plan.version || 1}`;
  };

  // Group therapy plans by set (memoized to avoid recomputation)
  const groupedTherapyPlans = useMemo(() => {
    const grouped: Record<string, { setKey: string; displayName: string; plans: TherapyPlan[] }> = {};
    
    therapyPlans.forEach((plan) => {
      const setKey = getPlanSetKey(plan);
      
      // Generate user-friendly display name (matching MemberTherapyPlansTab logic)
      let displayName: string;
      if (plan.setName && plan.setName.trim()) {
        displayName = plan.setName;
      } else if (plan.setCode) {
        // Extract the last number from setCode (e.g., "TPS-PST-MBR-PST-0008-003" -> "003")
        const match = plan.setCode.match(/(\d+)$/);
        const date = new Date(plan.createdAt);
        const dateStr = date.toLocaleDateString('id-ID', { 
          day: '2-digit', 
          month: 'short'
        });
        
        if (match) {
          const setNumber = parseInt(match[1], 10);
          displayName = `Set #${setNumber} - ${dateStr}`;
        } else {
          // If no number found, use date + time
          const timeStr = date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
          });
          displayName = `Set ${dateStr} ${timeStr}`;
        }
      } else {
        // Fallback for legacy data without setCode
        const date = new Date(plan.createdAt);
        const dateStr = date.toLocaleDateString('id-ID', { 
          day: '2-digit', 
          month: 'short'
        });
        const timeStr = date.toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false
        });
        displayName = `Set ${dateStr} ${timeStr}`;
      }
      
      if (!grouped[setKey]) {
        grouped[setKey] = {
          setKey,
          displayName,
          plans: []
        };
      }
      grouped[setKey].plans.push(plan);
    });
    
    return grouped;
  }, [therapyPlans]);

  // Auto-expand the first set when therapy plans load
  useEffect(() => {
    if (therapyPlans.length > 0 && expandedSets.size === 0) {
      const setKeys = Object.keys(groupedTherapyPlans);
      if (setKeys.length > 0) {
        setExpandedSets(new Set([setKeys[0]]));
      }
    }
  }, [therapyPlans, groupedTherapyPlans]);

  const loadInfusSetStock = async (targetBranchId?: string) => {
    // Use targetBranchId if provided, otherwise use user's branchId
    const branchId = targetBranchId || user?.branchId;
    
    if (!branchId) {
      devLog('No branchId available for infus set stock check');
      // For Admin Manager without direct branchId, we'll check when member is selected
      setInfusSetStock(null);
      return;
    }
    
    try {
      setLoadingInfusSetStock(true);
      devLog('Loading infus set stock for branch:', branchId);
      const response = await inventoryApi.getAvailableItems(branchId);
      
      // Debug: log the full response structure
      devLog('Full API response:', response);
      devLog('response.data:', response.data);
      
      // API returns axios response: { data: { success: true, data: items } }
      // So we need response.data.data to get the items array
      let items: any[] = [];
      if (response.data?.data && Array.isArray(response.data.data)) {
        items = response.data.data;
      } else if (Array.isArray(response.data)) {
        items = response.data;
      } else if (response.data?.success && response.data?.data) {
        items = response.data.data;
      }
      
      devLog('Inventory items received:', items?.length || 0);
      devLog('All items SKUs:', items.map((item: any) => item.masterProduct?.sku || item.sku));
      
      // Find Infus Set + Pelengkap (PRD-INF-SET-002) - this is the required product for therapy sessions
      // The API returns items with masterProduct nested object
      let infusSetItem = items.find((item: any) => {
        const sku = item.masterProduct?.sku || item.sku;
        devLog('Checking item:', item.masterProduct?.name, 'SKU:', sku);
        return sku === 'PRD-INF-SET-002'; // Only check for "Infus Set + Pelengkap"
      });
      
      // Fallback: search by name if SKU not found
      if (!infusSetItem) {
        devLog('SKU not found, searching by name...');
        infusSetItem = items.find((item: any) => {
          const name = (item.masterProduct?.name || item.name || '').toLowerCase();
          return name.includes('infus set') && name.includes('pelengkap');
        });
      }
      
      devLog('Infus Set + Pelengkap item found:', infusSetItem ? 'yes' : 'no');
      if (infusSetItem) {
        devLog('Found item details:', {
          name: infusSetItem.masterProduct?.name,
          sku: infusSetItem.masterProduct?.sku,
          stock: infusSetItem.stock,
          stockInfo: infusSetItem.stockInfo
        });
      }
      
      if (infusSetItem) {
        // Stock can be in stockInfo.baseStock, stock, or quantity field
        const stock = infusSetItem.stockInfo?.baseStock ?? 
                      Number(infusSetItem.stock) ?? 
                      infusSetItem.quantity ?? 0;
        const name = infusSetItem.masterProduct?.name || infusSetItem.name || 'Infus Set + Pelengkap';
        devLog('Infus set stock:', stock, 'name:', name);
        setInfusSetStock(Math.floor(stock));
        setInfusSetProductName(name);
      } else {
        devLog('No infus set item found in inventory - setting stock to 0');
        // Item not found in inventory - this could mean:
        // 1. The product doesn't exist in this branch's inventory
        // 2. The SKU doesn't match
        // Let's not block session creation if we can't find the item
        // Backend will do the final validation
        setInfusSetStock(null); // null means "unknown" - don't show warning
      }
    } catch (err) {
      devError('Failed to load infus set stock:', err);
      // On error, set to null (unknown) instead of 0 (out of stock)
      // This prevents false "out of stock" warnings
      setInfusSetStock(null);
    } finally {
      setLoadingInfusSetStock(false);
    }
  };

  const loadMemberData = async (id: string) => {
    try {
      const memberDetail = await memberApi.getMemberById(id);
      setMemberNo(memberDetail.memberNo);
      setMemberName(memberDetail.profile?.fullName || '');

      // Load infus set stock based on member's registration branch
      // This is important for Admin Manager who doesn't have direct branchId
      const memberBranchId = memberDetail.registrationBranch?.id;
      devLog('Member detail loaded:', {
        memberNo: memberDetail.memberNo,
        registrationBranch: memberDetail.registrationBranch,
        memberBranchId
      });
      
      if (memberBranchId) {
        setSessionBranchId(memberBranchId);
        devLog('Loading infus set stock for member branch:', memberBranchId);
        await loadInfusSetStock(memberBranchId);
      } else {
        devLog('No registrationBranch.id found for member, using user branchId');
        // Fallback to user's branchId if member doesn't have registrationBranch
        if (user?.branchId) {
          await loadInfusSetStock(user.branchId);
        }
      }

      const pkgs = await memberApi.getMemberPackages(id);
      const flatPackages: MemberPackage[] = [];
      pkgs.forEach((pkg: any) => {
        if (pkg.isGroup) {
          if (pkg.basics && Array.isArray(pkg.basics)) {
            pkg.basics.forEach((basic: any) => {
              flatPackages.push({
                ...basic,
                packageType: basic.packageType as 'BASIC' | 'BOOSTER',
                status: basic.status as MemberPackage['status'],
              });
            });
          }
          if (pkg.boosters && Array.isArray(pkg.boosters)) {
            pkg.boosters.forEach((booster: any) => {
              flatPackages.push({
                ...booster,
                packageType: booster.packageType as 'BASIC' | 'BOOSTER',
                status: booster.status as MemberPackage['status'],
              });
            });
          }
        } else {
          flatPackages.push({
            ...pkg,
            packageType: pkg.packageType as 'BASIC' | 'BOOSTER',
            status: pkg.status as MemberPackage['status'],
          });
        }
      });

      const debtSessionsUsed = flatPackages
        .filter((p) => p.packageType === 'BASIC' && isDebtPackageStatus(p.status))
        .reduce((sum, p) => sum + p.usedSessions, 0);
      setOutstandingDebtSessions(debtSessionsUsed);

      const usablePackages = flatPackages.filter((p) => isPackageUsableForSession(p, debtSessionsUsed));
      setPackages(usablePackages);

      const activeBasicRemaining = usablePackages
        .filter((p) => p.packageType === 'BASIC' && p.status === 'ACTIVE')
        .reduce((sum, p) => sum + p.remainingSessions, 0);
      const pendingBasicRemaining = flatPackages
        .filter((p) => p.packageType === 'BASIC' && isDebtPackageStatus(p.status))
        .reduce((sum, p) => sum + p.remainingSessions, 0);
      const debtUsableSessions = Math.max(
        0,
        Math.min(pendingBasicRemaining, DEBT_SESSION_LIMIT - debtSessionsUsed)
      );
      const totalUsableSessions = activeBasicRemaining + debtUsableSessions;
      setVoucherCount(totalUsableSessions);

      const basicPackage =
        usablePackages.find((p) => p.packageType === 'BASIC' && p.status === 'ACTIVE') ||
        usablePackages.find((p) => p.packageType === 'BASIC');
      if (basicPackage) {
        setSelectedPackageId(basicPackage.packageId);
        setSessionBranchId(basicPackage.branchId || memberBranchId || user?.branchId || '');
      } else {
        setSelectedPackageId('');
      }
    } catch (err: any) {
      devError('Failed to load member data:', err);
      setError(err.response?.data?.error?.message || 'Gagal memuat data member');
    }
  };

  const getPackageDisplayName = (pkg: MemberPackage) => {
    const debtLabel = isDebtEligiblePackage(pkg, outstandingDebtSessions)
      ? ` - Utang tersedia: ${getDebtRemainingSessions(pkg, outstandingDebtSessions)} sesi`
      : '';

    if (pkg.packageCode && pkg.packageCode.startsWith('Booster ')) {
      return `${pkg.packageCode} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})${debtLabel}`;
    }
    const code = pkg.productCode || pkg.packageCode;
    if (pkg.packageType === 'BASIC') {
      if (pkg.productCode) {
        const parts = pkg.productCode.split('-');
        if (parts[0] === 'TNB' && parts.length >= 2) {
          const sessionMatch = parts[1].match(/P(\d+)/);
          const sessions = sessionMatch ? sessionMatch[1] : pkg.totalSessions;
          return `NB${sessions} - ${sessions} sesi (sisa: ${pkg.remainingSessions})${debtLabel}`;
        }
      }
      return `${code} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})${debtLabel}`;
    } else {
      if (pkg.productCode) {
        const parts = pkg.productCode.split('-');
        if (parts[0] === 'BST' && parts.length >= 2) {
          const boosterType = parts[1];
          const boosterNames: Record<string, string> = {
            'NO': 'NO', 'GT': 'GT', 'MB': 'MB', 'KCL': 'KCL', 'H2S': 'H2S',
            'HK': 'H2S Konsentrat', 'O3': 'O3', 'HHO': 'HHO', 'PST': 'NO', 'NO2': 'NO'
          };
          const fullName = boosterNames[boosterType] || boosterType;
          return `Booster ${fullName} - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})${debtLabel}`;
        }
      }
      return `Booster - ${pkg.totalSessions} sesi (sisa: ${pkg.remainingSessions})${debtLabel}`;
    }
  };

  const loadTherapyPlans = async (id: string) => {
    try {
      setLoadingTherapyPlans(true);
      const plans = await therapyPlanApi.getMemberTherapyPlans(id);
      // Filter: only show plans that are NOT used and belong to active/current set.
      const availablePlans = plans
        .filter(p => !p.isUsed && !p.supersededById && p.setStatus !== 'SUPERSEDED')
        .sort((a, b) => (a.planNumber || 9999) - (b.planNumber || 9999));
      setTherapyPlans(availablePlans);
      if (availablePlans.length > 0) {
        setSelectedTherapyPlanId(availablePlans[0].id);
      }
    } catch (err: any) {
      devError('Failed to load therapy plans:', err);
      showToast.error('Gagal memuat therapy plans');
    } finally {
      setLoadingTherapyPlans(false);
    }
  };

  const loadDiagnoses = async (id: string) => {
    try {
      setLoadingDiagnoses(true);
      const memberDiagnoses = await diagnosisApi.getMemberDiagnoses(id);
      setDiagnoses(memberDiagnoses);
      setHasDiagnosis(memberDiagnoses.length > 0);
    } catch (err: any) {
      devError('Failed to load diagnoses:', err);
      setDiagnoses([]);
      setHasDiagnosis(false);
    } finally {
      setLoadingDiagnoses(false);
    }
  };

  const loadSuggestedSessionNumbers = async (id: string, targetBranchId?: string) => {
    try {
      const suggested = await sessionApi.getSuggestedSessionNumbers(id, targetBranchId);
      setCalculatedGlobalInfusKe(suggested.globalInfusKe);
      setCalculatedBranchInfusKe(suggested.branchInfusKe);
    } catch (err: any) {
      devError('Failed to load suggested session numbers:', err);
      try {
        // Fallback for older API responses: member sessions are SessionDetail objects.
        const sessions = await sessionApi.getMemberSessions(id);
        const sessionRows = sessions
          .map((sessionDetail: SessionDetail) => sessionDetail.session)
          .filter(Boolean);

        if (sessionRows.length > 0) {
          const maxGlobal = sessionRows.reduce(
            (max, session) => Math.max(max, Number(session.infusKe) || 0),
            0
          );
          const branchSessions = targetBranchId
            ? sessionRows.filter((session) => session.branchId === targetBranchId)
            : [];
          const maxBranch = branchSessions.reduce(
            (max, session) => Math.max(max, Number(session.branchInfusKe) || 0),
            0
          );

          setCalculatedGlobalInfusKe(maxGlobal + 1);
          setCalculatedBranchInfusKe(maxBranch > 0 ? maxBranch + 1 : branchSessions.length + 1);
        } else {
          setCalculatedGlobalInfusKe(1);
          setCalculatedBranchInfusKe(1);
        }
      } catch (fallbackErr: any) {
        devError('Failed to load fallback suggested session numbers:', fallbackErr);
        setCalculatedGlobalInfusKe(1);
        setCalculatedBranchInfusKe(1);
      }
    }
  };

  const loadStaff = async (targetBranchId?: string) => {
    try {
      const userRole = user?.role;
      const branchFilter = targetBranchId || user?.branchId || undefined;
      if (userRole === 'DOCTOR') {
        const [adminList, nursesList] = await Promise.all([
          usersApi.getAdminLayanan(branchFilter),
          usersApi.getNurses(branchFilter),
        ]);
        setAdminLayananList(adminList);
        setNurses(nursesList);
      } else if (userRole === 'NURSE') {
        const [adminList, doctorsList] = await Promise.all([
          usersApi.getAdminLayanan(branchFilter),
          usersApi.getDoctors(branchFilter),
        ]);
        setAdminLayananList(adminList);
        setDoctors(doctorsList);
      } else if (['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(userRole || '')) {
        // Global admins and ADMIN_CABANG can select all three: Admin Layanan, Doctor, and Nurse
        const [adminList, doctorsList, nursesList] = await Promise.all([
          usersApi.getAdminLayanan(branchFilter),
          usersApi.getDoctors(branchFilter),
          usersApi.getNurses(branchFilter),
        ]);
        setAdminLayananList(adminList);
        setDoctors(doctorsList);
        setNurses(nursesList);
      } else {
        // ADMIN_LAYANAN - auto-assign as admin layanan, select doctor and nurse
        const [doctorsList, nursesList] = await Promise.all([
          usersApi.getDoctors(branchFilter),
          usersApi.getNurses(branchFilter),
        ]);
        setDoctors(doctorsList);
        setNurses(nursesList);
      }
    } catch (err) {
      devError('Failed to load staff:', err);
      setError('Gagal memuat data staff');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const userRole = user?.role;
    const canSelectAllStaff = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(userRole || '');
    const effectiveSessionBranchId = sessionBranchId || user?.branchId || '';

    if (!memberId) { setError('Member harus dipilih'); return; }
    if (!hasDiagnosis) { setError('Member belum memiliki diagnosa. Silakan buat diagnosa terlebih dahulu.'); return; }
    if ((userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER') && !effectiveSessionBranchId) {
      setError('Cabang sesi belum terdeteksi. Pilih paket member terlebih dahulu.');
      return;
    }
    
    // Note: Infus Set validation is done on backend - frontend only shows warning
    // Backend will reject if stock is not available
    
    if (!selectedPackageId) { setError('Paket Basic harus dipilih'); return; }
    if (useBooster && !selectedBoosterPackageId) { setError('Paket Booster harus dipilih'); return; }
    // Validasi IFA - therapy plan harus memiliki IFA 250 atau IFA 500
    const selectedPlanForValidation = therapyPlans.find(p => p.id === selectedTherapyPlanId);
    if (selectedPlanForValidation) {
      const hasIfa = (selectedPlanForValidation.ifa250 && selectedPlanForValidation.ifa250 > 0) || 
                     (selectedPlanForValidation.ifa500 && selectedPlanForValidation.ifa500 > 0);
      if (!hasIfa) {
        setError('Therapy plan harus memiliki IFA (IFA 250ml atau IFA 500ml). Silakan pilih therapy plan lain atau buat ulang set therapy plan melalui bulk.');
        return;
      }
    }

    if (userRole === 'DOCTOR') {
      if (!selectedAdminLayananId) { setError('Admin Layanan harus dipilih'); return; }
      if (!selectedNurseId) { setError('Nakes harus dipilih'); return; }
    } else if (userRole === 'NURSE') {
      if (!selectedAdminLayananId) { setError('Admin Layanan harus dipilih'); return; }
      if (!selectedDoctorId) { setError('Dokter harus dipilih'); return; }
    } else if (canSelectAllStaff) {
      // SUPER_ADMIN, ADMIN_MANAGER, and ADMIN_CABANG must select all three
      if (!selectedAdminLayananId) { setError('Admin Layanan harus dipilih'); return; }
      if (!selectedDoctorId) { setError('Dokter harus dipilih'); return; }
      if (!selectedNurseId) { setError('Nakes harus dipilih'); return; }
    } else {
      // ADMIN_LAYANAN - auto-assign as admin layanan
      if (!selectedDoctorId) { setError('Dokter harus dipilih'); return; }
      if (!selectedNurseId) { setError('Nakes harus dipilih'); return; }
    }

    if (!treatmentDate) { setError('Tanggal & waktu terapi harus diisi'); return; }

    // Validate manual numbering if enabled
    if (useManualNumbering) {
      if (!manualInfusKe || manualInfusKe < 1) {
        setError('Nomor sesi global harus diisi dan lebih besar dari 0');
        return;
      }
      if (!manualBranchInfusKe || manualBranchInfusKe < 1) {
        setError('Nomor sesi cabang harus diisi dan lebih besar dari 0');
        return;
      }
    }

    const selectedPkg = packages.find(p => p.packageId === selectedPackageId);
    if (!selectedPkg || selectedPkg.remainingSessions <= 0) {
      setError('Paket yang dipilih tidak memiliki sesi tersisa'); return;
    }
    if (selectedPkg.status !== 'ACTIVE' && !isDebtEligiblePackage(selectedPkg, outstandingDebtSessions)) {
      setError('Paket belum dibayar dan jatah utang 2 sesi sudah habis. Verifikasi pembayaran untuk membuat sesi berikutnya.');
      return;
    }

    if (useBooster && selectedBoosterPackageId) {
      const selectedBooster = packages.find(p => p.packageId === selectedBoosterPackageId);
      if (!selectedBooster || selectedBooster.remainingSessions <= 0) {
        setError('Paket booster tidak memiliki sesi tersisa'); return;
      }
    }

    setLoading(true);
    try {
      const baseData = {
        branchId: effectiveSessionBranchId || undefined,
        memberId,
        memberPackageId: selectedPackageId,
        boosterPackageId: useBooster ? selectedBoosterPackageId || undefined : undefined,
        therapyPlanId: selectedTherapyPlanId || undefined,
        treatmentDate: new Date(treatmentDate).toISOString(),
        pelaksanaan,
        useManualNumbering,
        manualInfusKe: useManualNumbering && manualInfusKe ? Number(manualInfusKe) : undefined,
        manualBranchInfusKe: useManualNumbering && manualBranchInfusKe ? Number(manualBranchInfusKe) : undefined,
      };

      let data: CreateSessionInput;
      if (userRole === 'DOCTOR') {
        data = { ...baseData, adminLayananId: selectedAdminLayananId, doctorId: user?.userId || '', nurseId: selectedNurseId };
      } else if (userRole === 'NURSE') {
        data = { ...baseData, adminLayananId: selectedAdminLayananId, doctorId: selectedDoctorId, nurseId: user?.userId || '' };
      } else if (canSelectAllStaff) {
        // SUPER_ADMIN, ADMIN_MANAGER, and ADMIN_CABANG select all three positions
        data = { ...baseData, adminLayananId: selectedAdminLayananId, doctorId: selectedDoctorId, nurseId: selectedNurseId };
      } else {
        // ADMIN_LAYANAN - auto-assign as admin layanan
        data = { ...baseData, adminLayananId: user?.userId || '', doctorId: selectedDoctorId, nurseId: selectedNurseId };
      }

      const result = await sessionApi.createSession(data);
      showToast.success(result.message || 'Sesi terapi berhasil dibuat');
      onSuccess(result.sessionId);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Gagal membuat sesi';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setMemberId('');
      setMemberNo('');
      setMemberName('');
      setSessionBranchId(user?.branchId || '');
      setVoucherCount(0);
      setOutstandingDebtSessions(0);
      setPackages([]);
      setSelectedPackageId('');
      setUseBooster(false);
      setSelectedBoosterPackageId('');
      setTherapyPlans([]);
      setSelectedTherapyPlanId('');
      setExpandedSets(new Set());
      setDiagnoses([]);
      setHasDiagnosis(false);
      setSelectedDoctorId('');
      setSelectedNurseId('');
      setSelectedAdminLayananId('');
      setUseManualNumbering(false);
      setManualInfusKe('');
      setManualBranchInfusKe('');
      setCalculatedGlobalInfusKe(null);
      setCalculatedBranchInfusKe(null);
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const basicPackages = packages.filter((p) => p.packageType === 'BASIC');
  const boosterPackagesRaw = packages.filter((p) => p.packageType === 'BOOSTER');
  const boosterPackagesMap = new Map<string, MemberPackage>();
  
  boosterPackagesRaw.forEach((pkg) => {
    const displayName = getPackageDisplayName(pkg);
    const boosterNameMatch = displayName.match(/^(Booster\s+\w+)/);
    const boosterName = boosterNameMatch ? boosterNameMatch[1] : displayName;
    
    if (boosterPackagesMap.has(boosterName)) {
      const existing = boosterPackagesMap.get(boosterName)!;
      boosterPackagesMap.set(boosterName, {
        ...existing,
        remainingSessions: existing.remainingSessions + pkg.remainingSessions,
        totalSessions: existing.totalSessions + pkg.totalSessions,
      });
    } else {
      boosterPackagesMap.set(boosterName, { ...pkg, packageCode: boosterName });
    }
  });
  const boosterPackages = Array.from(boosterPackagesMap.values());

  const selectedPlan = therapyPlans.find(p => p.id === selectedTherapyPlanId);
  const selectedPackage = basicPackages.find(p => p.packageId === selectedPackageId);
  const canSelectAllStaffForRole = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '');

  // Toggle accordion
  const toggleSet = (setKey: string) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setKey)) {
        newSet.delete(setKey);
      } else {
        newSet.add(setKey);
      }
      return newSet;
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Buat Sesi Terapi Baru</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Isi data untuk membuat sesi baru</p>
              </div>
            </div>
            <button onClick={handleClose} disabled={loading} className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 px-6">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'form'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Form Sesi
            </button>
            <button
              onClick={() => setActiveTab('therapyPlan')}
              disabled={!selectedTherapyPlanId}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'therapyPlan'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Detail Therapy Plan
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'form' ? (
              <form onSubmit={handleSubmit} className="space-y-5" id="create-session-form">
                {error && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Member Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <User className="h-4 w-4" /> Member <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="Masukkan Member ID"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    disabled={loading || !!preselectedMemberId}
                  />
                  {memberNo && (
                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{memberNo} - {memberName}</p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Voucher bisa digunakan: <span className="font-bold text-amber-600 dark:text-amber-400">{voucherCount}</span></p>
                    </div>
                  )}
                </div>

                {/* Diagnosis Status */}
                {memberId && !loadingDiagnoses && !hasDiagnosis && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Member belum memiliki diagnosa</p>
                      <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">Buat diagnosa di tab Diagnosa pada halaman detail member.</p>
                    </div>
                  </div>
                )}
                {memberId && loadingDiagnoses && (
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <RefreshCw className="h-4 w-4 animate-spin text-neutral-500" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Memeriksa diagnosa member...</p>
                  </div>
                )}
                {memberId && !loadingDiagnoses && hasDiagnosis && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Member memiliki {diagnoses.length} diagnosa</p>
                  </div>
                )}

                {/* Infus Set Stock Warning */}
                {loadingInfusSetStock && (
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <RefreshCw className="h-4 w-4 animate-spin text-neutral-500" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Memeriksa stok Infus Set...</p>
                  </div>
                )}
                {!loadingInfusSetStock && infusSetStock !== null && infusSetStock < 1 && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Stok {infusSetProductName} habis!</p>
                      <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                        Tidak dapat membuat sesi terapi karena stok {infusSetProductName} tidak tersedia. 
                        Silakan request stok terlebih dahulu di menu Inventory.
                      </p>
                    </div>
                  </div>
                )}
                {!loadingInfusSetStock && infusSetStock !== null && infusSetStock >= 1 && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Stok {infusSetProductName}: <span className="font-bold">{infusSetStock}</span> tersedia
                    </p>
                  </div>
                )}

                {/* Package Selection */}
                {basicPackages.length === 0 && memberId ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Tidak ada paket yang bisa digunakan</p>
                      <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">Assign paket, verifikasi pembayaran, atau gunakan paket belum bayar yang masih memiliki jatah utang 2 sesi pertama.</p>
                    </div>
                  </div>
                ) : basicPackages.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      <Package className="h-4 w-4" /> Paket Basic <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      disabled={loading}
                    >
                      <option value="">Pilih paket...</option>
                      {basicPackages.map((pkg) => (
                        <option key={pkg.packageId} value={pkg.packageId}>{getPackageDisplayName(pkg)}</option>
                      ))}
                    </select>
                    {selectedPackage && isDebtEligiblePackage(selectedPackage, outstandingDebtSessions) && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Paket ini belum dibayar. Sesi akan dicatat sebagai utang dan voucher otomatis berkurang saat sesi dibuat. Sisa utang tersedia: {getDebtRemainingSessions(selectedPackage, outstandingDebtSessions)} sesi.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Booster Package */}
                {memberId && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useBooster}
                        onChange={(e) => { setUseBooster(e.target.checked); if (!e.target.checked) setSelectedBoosterPackageId(''); }}
                        className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 bg-white dark:bg-neutral-800"
                        disabled={loading || boosterPackages.length === 0}
                      />
                      <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Gunakan Paket Booster</span>
                    </label>
                    {useBooster && boosterPackages.length > 0 && (
                      <select
                        value={selectedBoosterPackageId}
                        onChange={(e) => setSelectedBoosterPackageId(e.target.value)}
                        className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                        disabled={loading}
                      >
                        <option value="">Pilih paket booster...</option>
                        {boosterPackages.map((pkg) => (
                          <option key={pkg.packageId} value={pkg.packageId}>{getPackageDisplayName(pkg)}</option>
                        ))}
                      </select>
                    )}
                    {useBooster && boosterPackages.length === 0 && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700 dark:text-amber-400">Member tidak memiliki paket booster ACTIVE</p>
                      </div>
                    )}
                    {!useBooster && boosterPackages.length === 0 && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Member belum memiliki paket booster</p>
                    )}
                  </div>
                )}

                {/* Therapy Plan */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Therapy Plan <span className="text-red-500">*</span>
                  </label>
                  {loadingTherapyPlans ? (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      <RefreshCw className="h-4 w-4 animate-spin text-neutral-500" />
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">Memuat therapy plans...</p>
                    </div>
                  ) : therapyPlans.length === 0 ? (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Belum ada therapy plan tersedia</p>
                        <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">Buat set therapy plan secara bulk di tab Therapy Plan pada halaman detail member.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Accordion/Collapsible Therapy Plan Selection */}
                      <div className="space-y-2 mb-3">
                        {Object.entries(groupedTherapyPlans).map(([setKey, setData]) => {
                          const isExpanded = expandedSets.has(setKey);
                          const plansCount = setData.plans.length;
                          const selectedInThisSet = setData.plans.some((p: TherapyPlan) => p.id === selectedTherapyPlanId);
                          
                          return (
                            <div key={setKey} className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                              {/* Accordion Header */}
                              <button
                                type="button"
                                onClick={() => toggleSet(setKey)}
                                className={`w-full px-4 py-3 flex items-center justify-between transition-all ${
                                  selectedInThisSet 
                                    ? 'bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20' 
                                    : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                }`}
                                disabled={loading}
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className={`h-4 w-4 ${selectedInThisSet ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500'}`} />
                                  <div className="text-left">
                                    <p className={`text-sm font-bold ${selectedInThisSet ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-white'}`}>
                                      {setData.displayName}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      {plansCount} therapy plan{plansCount > 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-neutral-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-neutral-500" />
                                )}
                              </button>

                              {/* Accordion Content */}
                              {isExpanded && (
                                <div className="border-t border-neutral-200 dark:border-neutral-700">
                                  {setData.plans.map((plan: TherapyPlan, index: number) => {
                                    const isSelected = selectedTherapyPlanId === plan.id;
                                    const planNumber = plan.planNumber || index + 1;
                                    
                                    // Build substance display - only show non-zero quantities
                                    const substances: string[] = [];
                                    if (plan.ifa250 && plan.ifa250 > 0) substances.push(`IFA 250: ${plan.ifa250}`);
                                    if (plan.ifa500 && plan.ifa500 > 0) substances.push(`IFA 500: ${plan.ifa500}`);
                                    const substanceText = substances.length > 0 ? substances.join(' • ') : 'Tidak ada IFA';
                                    
                                    return (
                                      <div
                                        key={plan.id}
                                        onClick={() => !loading && setSelectedTherapyPlanId(plan.id)}
                                        className={`cursor-pointer px-4 py-3 flex items-start gap-3 transition-all border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 ${
                                          isSelected 
                                            ? 'bg-amber-50 dark:bg-amber-500/10' 
                                            : 'bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name="therapyPlanId"
                                          checked={isSelected}
                                          onChange={() => setSelectedTherapyPlanId(plan.id)}
                                          disabled={loading}
                                          className="mt-1 w-4 h-4 text-amber-600 border-neutral-300 focus:ring-amber-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                                Terapi #{planNumber}
                                              </p>
                                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                                {substanceText}
                                              </p>
                                            </div>
                                            <div className="flex gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                                              {plan.ifa250 && plan.ifa250 > 0 && (
                                                <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                                                  {plan.ifa250}x250
                                                </span>
                                              )}
                                              {plan.ifa500 && plan.ifa500 > 0 && (
                                                <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                                                  {plan.ifa500}x500
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {plan.keterangan && (
                                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
                                              {plan.keterangan}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <select
                        hidden
                        value={selectedTherapyPlanId}
                        onChange={(e) => setSelectedTherapyPlanId(e.target.value)}
                        className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                        disabled={loading}
                      >
                        <option value="">Pilih therapy plan...</option>
                        {therapyPlans.map((plan) => {
                          const hasIfa = (plan.ifa250 && plan.ifa250 > 0) || (plan.ifa500 && plan.ifa500 > 0);
                          const ifaInfo = hasIfa
                            ? `IFA: ${plan.ifa250 || 0}x250ml, ${plan.ifa500 || 0}x500ml`
                            : 'Tidak ada IFA';
                          return (
                            <option key={plan.id} value={plan.id}>
                              Terapi #{plan.planNumber || 1} - {new Date(plan.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ({ifaInfo})
                            </option>
                          );
                        })}
                      </select>
                      {selectedPlan && (
                        <>
                          {/* Warning jika tidak ada IFA */}
                          {!((selectedPlan.ifa250 && selectedPlan.ifa250 > 0) || (selectedPlan.ifa500 && selectedPlan.ifa500 > 0)) && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Therapy plan tidak memiliki IFA</p>
                                <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">Setiap sesi terapi wajib memiliki IFA (IFA 250ml atau IFA 500ml). Silakan pilih therapy plan lain atau buat ulang set therapy plan melalui bulk.</p>
                              </div>
                            </div>
                          )}
                          {/* Info box jika ada IFA */}
                          {((selectedPlan.ifa250 && selectedPlan.ifa250 > 0) || (selectedPlan.ifa500 && selectedPlan.ifa500 > 0)) && (
                            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Klik tab "Detail Therapy Plan" untuk melihat detail lengkap
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400/80 mt-1">
                                    IFA 250: {selectedPlan.ifa250 || 0} Botol - IFA 500: {selectedPlan.ifa500 || 0} Botol - HHO: {selectedPlan.hho || '-'} - NO: {selectedPlan.no || '-'} ...
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Staff Selection - Role Based */}
                {/* DOCTOR: Auto-fill as Dokter, select Admin Layanan + Nakes */}
                {user?.role === 'DOCTOR' && (
                  <>
                    {/* Auto-filled Dokter info */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Dokter Utama: {user?.fullName || 'Anda'}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400/80">Otomatis terisi sebagai dokter yang membuat sesi</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Admin Layanan <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedAdminLayananId} onChange={(e) => setSelectedAdminLayananId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih admin layanan...</option>
                        {adminLayananList.map((admin) => (<option key={admin.userId} value={admin.userId}>{admin.fullName}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Nakes Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedNurseId} onChange={(e) => setSelectedNurseId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih nakes utama...</option>
                        {nurses.map((nurse) => (<option key={nurse.userId} value={nurse.userId}>{nurse.fullName}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {/* NURSE: Auto-fill as Nakes, select Admin Layanan + Dokter */}
                {user?.role === 'NURSE' && (
                  <>
                    {/* Auto-filled Nakes info */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Nakes Utama: {user?.fullName || 'Anda'}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400/80">Otomatis terisi sebagai nakes yang membuat sesi</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Admin Layanan <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedAdminLayananId} onChange={(e) => setSelectedAdminLayananId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih admin layanan...</option>
                        {adminLayananList.map((admin) => (<option key={admin.userId} value={admin.userId}>{admin.fullName}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Dokter Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih dokter utama...</option>
                        {doctors.map((doc) => (<option key={doc.userId} value={doc.userId}>{doc.fullName}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {/* ADMIN_LAYANAN: Auto-fill as Admin Layanan, select Dokter + Nakes */}
                {user?.role === 'ADMIN_LAYANAN' && (
                  <>
                    {/* Auto-filled Admin Layanan info */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Admin Layanan: {user?.fullName || 'Anda'}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400/80">Otomatis terisi sebagai admin layanan yang membuat sesi</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Dokter Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih dokter utama...</option>
                        {doctors.map((doc) => (<option key={doc.userId} value={doc.userId}>{doc.fullName}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Nakes Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedNurseId} onChange={(e) => setSelectedNurseId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih nakes utama...</option>
                        {nurses.map((nurse) => (<option key={nurse.userId} value={nurse.userId}>{nurse.fullName}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {/* SUPER_ADMIN / ADMIN_MANAGER / ADMIN_CABANG: Must select all three - Admin Layanan, Dokter, Nakes */}
                {canSelectAllStaffForRole && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Admin Layanan <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedAdminLayananId} onChange={(e) => setSelectedAdminLayananId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih admin layanan...</option>
                        {adminLayananList.map((admin) => (<option key={admin.userId} value={admin.userId}>{admin.fullName}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Dokter Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih dokter utama...</option>
                        {doctors.map((doc) => (<option key={doc.userId} value={doc.userId}>{doc.fullName}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Users className="h-4 w-4" /> Nakes Utama <span className="text-red-500">*</span>
                      </label>
                      <select value={selectedNurseId} onChange={(e) => setSelectedNurseId(e.target.value)} className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" disabled={loading}>
                        <option value="">Pilih nakes utama...</option>
                        {nurses.map((nurse) => (<option key={nurse.userId} value={nurse.userId}>{nurse.fullName}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {/* Treatment Date */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Tanggal & Waktu Terapi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={treatmentDate}
                    onChange={(e) => setTreatmentDate(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Pelaksanaan */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Pelaksanaan <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pelaksanaan"
                        value="ON_SITE"
                        checked={pelaksanaan === 'ON_SITE'}
                        onChange={(e) => setPelaksanaan(e.target.value as SessionType)}
                        className="w-4 h-4 text-amber-600 border-neutral-300 focus:ring-amber-500"
                        disabled={loading}
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">On Site (Di Klinik)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pelaksanaan"
                        value="HOME_CARE"
                        checked={pelaksanaan === 'HOME_CARE'}
                        onChange={(e) => setPelaksanaan(e.target.value as SessionType)}
                        className="w-4 h-4 text-amber-600 border-neutral-300 focus:ring-amber-500"
                        disabled={loading}
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Home Visit</span>
                    </label>
                  </div>
                </div>

                {/* Manual Session Numbering */}
                <div className="space-y-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Nomor Sesi Terapi
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useManualNumbering}
                        onChange={(e) => {
                          setUseManualNumbering(e.target.checked);
                          if (!e.target.checked) {
                            setManualInfusKe('');
                            setManualBranchInfusKe('');
                          }
                        }}
                        className="w-4 h-4 text-amber-600 border-neutral-300 rounded focus:ring-amber-500"
                        disabled={loading}
                      />
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Input Manual</span>
                    </label>
                  </div>

                  {!useManualNumbering && calculatedGlobalInfusKe !== null && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600">
                      <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-neutral-900 dark:text-white">
                          Sesi berikutnya (otomatis): <span className="text-amber-600 dark:text-amber-400">#{calculatedGlobalInfusKe}</span>
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Sesi ke-{calculatedBranchInfusKe} di cabang ini
                        </p>
                      </div>
                    </div>
                  )}

                  {useManualNumbering && (
                    <div className="space-y-3">
                      {/* Global Session Number */}
                      <div>
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">
                          Nomor Sesi Global <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={manualInfusKe}
                          onChange={(e) => setManualInfusKe(e.target.value ? parseInt(e.target.value) : '')}
                          placeholder={calculatedGlobalInfusKe ? `Saran: ${calculatedGlobalInfusKe}` : "Masukkan nomor sesi global"}
                          className="w-full px-4 py-2.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                          disabled={loading}
                          required={useManualNumbering}
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Total sesi member di semua cabang
                        </p>
                        {calculatedGlobalInfusKe && calculatedGlobalInfusKe !== manualInfusKe && (
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 mt-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Saran otomatis: <strong>#{calculatedGlobalInfusKe}</strong>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Branch Session Number */}
                      <div>
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1 block">
                          Nomor Sesi di Cabang Ini <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={manualBranchInfusKe}
                          onChange={(e) => setManualBranchInfusKe(e.target.value ? parseInt(e.target.value) : '')}
                          placeholder={calculatedBranchInfusKe ? `Saran: ${calculatedBranchInfusKe}` : "Masukkan nomor sesi cabang"}
                          className="w-full px-4 py-2.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                          disabled={loading}
                          required={useManualNumbering}
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Sesi member khusus di cabang saat ini
                        </p>
                        {calculatedBranchInfusKe && calculatedBranchInfusKe !== manualBranchInfusKe && (
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 mt-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Saran otomatis: <strong>#{calculatedBranchInfusKe}</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              /* Therapy Plan Detail Tab - Table View */
              <div className="space-y-4">
                {selectedPlan ? (
                  <>
                    {/* Set Header */}
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                      <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">
                        📋 {selectedPlan.setName || `Set v${selectedPlan.setVersion || selectedPlan.version || 1}`}
                      </h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400/80">
                        {(() => {
                          const setKey = getPlanSetKey(selectedPlan);
                          const setData = groupedTherapyPlans[setKey];
                          const plansCount = setData?.plans.length || 0;
                          return `${plansCount} Terapi dalam Set - Dibuat: ${new Date(selectedPlan.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;
                        })()}
                      </p>
                    </div>

                    {/* Table View - All therapy plans in one table */}
                    {(() => {
                      const setKey = getPlanSetKey(selectedPlan);
                      const setData = groupedTherapyPlans[setKey];
                      const plansInSet = setData?.plans || [selectedPlan];
                      
                      return (
                        <TherapyPlanListTable
                          plans={plansInSet}
                          memberId={memberId}
                          onOpenSession={() => {}}
                          hideInfusKe={true}
                          hideStatus={true}
                          hideAksi={true}
                        />
                      );
                    })()}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Pilih therapy plan terlebih dahulu</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="create-session-form"
              disabled={loading || !memberId || !hasDiagnosis || !selectedPackageId}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Membuat...
                </>
              ) : (
                <>
                  <Stethoscope className="h-4 w-4" />
                  Buat Sesi
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
