import { BranchMember } from './types';
import styles from './page.module.css';

interface MembersTabProps {
  members: BranchMember[];
  branchName: string;
  onAddMember: () => void;
  onViewMember: (memberId: string) => void;
}

export default function MembersTab({
  members,
  branchName,
  onAddMember,
  onViewMember,
}: MembersTabProps) {
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

      {members.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧑‍⚕️</div>
          <h3>Belum Ada Member</h3>
          <p>Belum ada member yang terdaftar di cabang ini</p>
          <button className={styles.createMemberBtn} onClick={onAddMember}>
            ➕ Tambah Member
          </button>
        </div>
      ) : (
        <div className={styles.membersGrid}>
          {members.map((m) => (
            <div key={m.memberId} className={styles.memberCard}>
              <div className={styles.memberHeader}>
                <div className={styles.memberAvatar}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.fullName} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {m.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
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
