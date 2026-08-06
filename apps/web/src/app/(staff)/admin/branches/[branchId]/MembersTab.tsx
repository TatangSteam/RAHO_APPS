'use client';

import AppImage from '@/components/ui/AppImage';
import { useEffect, useState } from 'react';
import { BranchMember } from './types';
import MemberAccountImportPanel from './MemberAccountImportPanel';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import styles from './page.module.css';

interface MembersTabProps {
  members: BranchMember[];
  branchId: string;
  branchName: string;
  onAddMember: () => void;
  onViewMember: (memberId: string) => void;
  onImported: () => void;
}

export default function MembersTab({
  members,
  branchId,
  branchName,
  onAddMember,
  onViewMember,
  onImported,
}: MembersTabProps) {
  const [nameFilter, setNameFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');

  const normalizedNameFilter = nameFilter.trim().toLocaleLowerCase('id-ID');
  const normalizedAgeFilter = ageFilter.trim();

  const filteredMembers = members.filter((member) => {
    const matchesName = !normalizedNameFilter || member.fullName.toLocaleLowerCase('id-ID').includes(normalizedNameFilter);
    const matchesAge = !normalizedAgeFilter || String(member.age ?? '') === normalizedAgeFilter;

    return matchesName && matchesAge;
  });

  const hasActiveFilter = normalizedNameFilter.length > 0 || normalizedAgeFilter.length > 0;

  return (
    <div className={styles.membersSection}>
      <div className={styles.membersHeader}>
        <div>
          <h3>🧑‍⚕️ Member Terdaftar di Cabang Ini</h3>
          <p className={styles.membersSubtitle}>
            Menampilkan member yang terdaftar di {branchName}
          </p>
        </div>
        <button className={styles.createMemberBtn} onClick={onAddMember}>
          ➕ Tambah Member
        </button>
      </div>

      <MemberAccountImportPanel branchId={branchId} onImported={onImported} />

      {members.length > 0 && (
        <div className={styles.memberFilters}>
          <div className={styles.memberFilterField}>
            <label htmlFor="member-name-filter" className={styles.memberFilterLabel}>Nama Member</label>
            <input
              id="member-name-filter"
              type="text"
              className={styles.memberFilterInput}
              placeholder="Cari nama member..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className={styles.memberFilterField}>
            <label htmlFor="member-age-filter" className={styles.memberFilterLabel}>Usia</label>
            <input
              id="member-age-filter"
              type="number"
              min="0"
              inputMode="numeric"
              className={styles.memberFilterInput}
              placeholder="Contoh: 30"
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
            />
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧑‍⚕️</div>
          <h3>Belum Ada Member</h3>
          <p>Belum ada member yang terdaftar di cabang ini</p>
          <button className={styles.createMemberBtn} onClick={onAddMember}>
            ➕ Tambah Member
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔎</div>
          <h3>Member Tidak Ditemukan</h3>
          <p>
            {hasActiveFilter
              ? 'Tidak ada member yang sesuai dengan filter nama atau usia'
              : 'Belum ada member yang dapat ditampilkan'}
          </p>
        </div>
      ) : (
        <div className={styles.membersGrid}>
          {filteredMembers.map((m) => (
            <div key={m.memberId} className={styles.memberCard}>
              <div className={styles.memberHeader}>
                <MemberAvatar member={m} />
                <div className={styles.memberHeaderInfo}>
                  <h4>{m.fullName}</h4>
                  <p className={styles.memberNo}>{m.memberNo}</p>
                </div>
                <span className={`${styles.memberStatus} ${m.isActive ? styles.active : styles.inactive}`}>
                  {m.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                </span>
              </div>

              <div className={styles.memberBody}>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Email:</span>
                  <span>{m.email}</span>
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Telepon:</span>
                  <span>{m.phone}</span>
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Usia:</span>
                  <span>{m.age ?? '-'}{m.age !== null ? ' tahun' : ''}</span>
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Cabang Registrasi:</span>
                  <span>{m.registrationBranch}</span>
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Voucher Terpakai:</span>
                  <span className={styles.voucherBadge}>{m.voucherCount}</span>
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.label}>Paket Aktif:</span>
                  <span className={styles.packageBadge}>{m.basicPackageCount}</span>
                </div>
                {m.isLintas && (
                  <div className={styles.lintasBadge}>
                    🔄 Member Lintas Cabang
                  </div>
                )}
              </div>

              <div className={styles.memberActions}>
                <button
                  className={styles.viewBtn}
                  onClick={() => onViewMember(m.memberId)}
                >
                  👁️ Lihat Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberAvatar({ member }: { member: BranchMember }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (member.fullName || 'M').charAt(0).toUpperCase();

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setImageFailed(false);
    setPhotoUrl(null);

    if (!member.photoUrl) {
      return;
    }

    if (member.photoUrl.startsWith('blob:') || member.photoUrl.startsWith('data:')) {
      setPhotoUrl(member.photoUrl);
      return;
    }

    createAuthenticatedObjectUrl(member.photoUrl)
      .then((url) => {
        objectUrl = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoUrl(null);
          setImageFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [member.photoUrl]);

  return (
    <div className={styles.memberAvatar}>
      <div className={styles.avatarPlaceholder}>{initial}</div>
      {photoUrl && !imageFailed && (
        <AppImage
          src={photoUrl}
          alt={member.fullName || 'Member'}
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
