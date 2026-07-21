'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { iamApi, Permission, RoleTemplate, UserAccess } from '@/lib/iamApi';
import { showToast } from '@/lib/toast';

interface StaffOption {
  id: string;
  email: string;
  role: string;
  profile?: { fullName?: string };
}

interface BranchOption { id: string; branchCode: string; name: string }

export default function PermissionManagementPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateCodes, setTemplateCodes] = useState<Set<string>>(new Set());
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 'INHERIT' | 'ALLOW' | 'DENY'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      iamApi.permissions(),
      iamApi.roleTemplates(),
      api.get('/users', { params: { limit: 100 } }),
      api.get('/branches/all'),
    ]).then(([permissionData, templateData, usersResponse, branchesResponse]) => {
      setPermissions(permissionData.filter((item) => item.isActive));
      setTemplates(templateData);
      setStaff(usersResponse.data.data || []);
      setBranches(branchesResponse.data.data || []);
      if (templateData[0]) setSelectedTemplateId(templateData[0].id);
    }).catch(() => showToast.error('Gagal memuat konfigurasi IAM.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);
  useEffect(() => {
    setTemplateCodes(new Set(selectedTemplate?.permissions.map((item) => item.permission.code) || []));
  }, [selectedTemplateId, selectedTemplate]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserAccess(null);
      return;
    }
    iamApi.userAccess(selectedUserId).then((access) => {
      setUserAccess(access);
      setSelectedBranchIds(new Set(access.accessibleBranchIds || []));
      const next: Record<string, 'INHERIT' | 'ALLOW' | 'DENY'> = {};
      permissions.forEach((permission) => { next[permission.code] = 'INHERIT'; });
      access.permissionOverrides
        .filter((item) => !item.branchId)
        .forEach((item) => { next[item.permission.code] = item.effect; });
      setOverrides(next);
    }).catch(() => showToast.error('Gagal memuat akses user.'));
  }, [selectedUserId, permissions]);

  const grouped = useMemo(() => permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    (acc[permission.module] ||= []).push(permission);
    return acc;
  }, {}), [permissions]);

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await iamApi.replaceTemplatePermissions(selectedTemplate.id, Array.from(templateCodes));
      setTemplates(await iamApi.roleTemplates());
      showToast.success('Permission role template tersimpan dan tercatat di audit log.');
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal menyimpan role template.');
    } finally { setSaving(false); }
  };

  const saveUserAccess = async () => {
    if (!selectedUserId || !userAccess) return;
    setSaving(true);
    try {
      const selected = staff.find((item) => item.id === selectedUserId);
      if (selectedBranchIds.size === 0) throw new Error('Pilih minimal satu branch untuk user.');
      await iamApi.replaceUserBranches(selectedUserId, Array.from(selectedBranchIds), Array.from(selectedBranchIds)[0]);
      await iamApi.assignRoleTemplate(selectedUserId, userAccess.roleTemplateId);
      const payload = Object.entries(overrides)
        .filter(([, effect]) => effect !== 'INHERIT')
        .map(([permissionCode, effect]) => ({
          permissionCode,
          effect: effect as 'ALLOW' | 'DENY',
          reason: `Override melalui UI IAM untuk ${selected?.email || selectedUserId}`,
        }));
      const next = await iamApi.replaceUserOverrides(selectedUserId, payload);
      setUserAccess(next);
      showToast.success('Akses user tersimpan dan tercatat di audit log.');
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || error.message || 'Gagal menyimpan akses user.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 text-sm text-neutral-500">Memuat permission…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck /> Permission & Role Template</h1>
        <p className="mt-1 text-sm text-neutral-500">Permission efektif berasal dari template, lalu dipengaruhi ALLOW/DENY override user.</p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <label className="grid gap-1 text-sm">Role template
            <select className="rounded-lg border bg-transparent px-3 py-2" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.code})</option>)}
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} onClick={saveTemplate}>Simpan template</button>
        </div>
        <PermissionGrid grouped={grouped} renderControl={(permission) => (
          <input type="checkbox" checked={templateCodes.has(permission.code)} onChange={(event) => setTemplateCodes((current) => {
            const next = new Set(current);
            event.target.checked ? next.add(permission.code) : next.delete(permission.code);
            return next;
          })} />
        )} />
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><UsersRound size={20} /> User override</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">User
            <select className="rounded-lg border bg-transparent px-3 py-2" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              <option value="">Pilih user</option>
              {staff.map((item) => <option key={item.id} value={item.id}>{item.profile?.fullName || item.email} — {item.role}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Role template
            <select className="rounded-lg border bg-transparent px-3 py-2" disabled={!userAccess} value={userAccess?.roleTemplateId || ''} onChange={(event) => setUserAccess((current) => current ? { ...current, roleTemplateId: event.target.value || null } : current)}>
              <option value="">Default sesuai base role</option>
              {templates.filter((item) => item.isActive).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        </div>
        {userAccess && <div className="mt-5">
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium">Branch scope</p>
            <div className="flex flex-wrap gap-2">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-neutral-800">
              <input type="checkbox" checked={selectedBranchIds.has(branch.id)} onChange={(event) => setSelectedBranchIds((current) => {
                const next = new Set(current);
                event.target.checked ? next.add(branch.id) : next.delete(branch.id);
                return next;
              })} />
              {branch.branchCode} — {branch.name}
            </label>)}</div>
          </div>
          <p className="mb-3 text-xs text-neutral-500">Gunakan ALLOW/DENY hanya untuk pengecualian dari role template.</p>
          <PermissionGrid grouped={grouped} renderControl={(permission) => (
            <select className="rounded border bg-transparent px-2 py-1 text-xs" value={overrides[permission.code] || 'INHERIT'} onChange={(event) => setOverrides((current) => ({ ...current, [permission.code]: event.target.value as any }))}>
              <option value="INHERIT">Ikuti template</option><option value="ALLOW">ALLOW</option><option value="DENY">DENY</option>
            </select>
          )} />
          <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} onClick={saveUserAccess}>Simpan akses user</button>
        </div>}
      </section>
    </div>
  );
}

function PermissionGrid({ grouped, renderControl }: { grouped: Record<string, Permission[]>; renderControl: (permission: Permission) => React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{Object.entries(grouped).map(([module, items]) => (
    <div key={module} className="rounded-lg border p-3 dark:border-neutral-800">
      <h3 className="mb-2 text-sm font-semibold">{module}</h3>
      <div className="space-y-2">{items.map((permission) => (
        <label key={permission.code} className="flex items-center justify-between gap-3 text-sm">
          <span><span className="block">{permission.name}</span><code className="text-[11px] text-neutral-500">{permission.code}</code></span>
          {renderControl(permission)}
        </label>
      ))}</div>
    </div>
  ))}</div>;
}
