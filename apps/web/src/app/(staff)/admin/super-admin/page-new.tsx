'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import Link from 'next/link';
import { 
  Activity, Users, Package, FileText, Building2, UserCheck, 
  UsersRound, DollarSign, Stethoscope, TrendingUp, Shield,
  BarChart3, RefreshCw, Plus, Eye, Loader2, Clock,
  CheckCircle2, AlertCircle, ArrowRight, LogIn, LogOut,
  UserPlus, Edit, Trash2
} from 'lucide-react';
import { AdminManagersTab } from '@/components/admin/AdminManagersTab';

type TabType = 'overview' | 'admin-managers' | 'master-products' | 'audit-logs';

interface SystemStats {
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  activeUsers: number;
  totalMembers: number;
  activeMembers: number;
  totalProducts: number;
  activeProducts: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  monthlySessions: number;
  usersByRole: {
    role: string;
    count: number;
  }[];
  recentActivities: {
    id: string;
    action: string;
    userName: string;
    userEmail: string;
    branchName: string | null;
    createdAt: string;
  }[];
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
