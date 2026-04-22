import { User } from './types';
import styles from './page.module.css';

interface UsersTabProps {
  users: User[];
  onAddUser: () => void;
  onToggleUserActive: (userId: string, currentStatus: boolean) => void;
}

const getRoleBadge = (role: string) => {
  const roleMap: Record<string, { label: string; className: string }> = {
    ADMIN_CABANG: { label: 'Admin Cabang', className: styles.roleAdminCabang },
    DOCTOR: { label: 'Dokter', className: styles.roleDoctor },
    NURSE: { label: 'Perawat', className: styles.roleNurse },
    ADMIN_LAYANAN: { label: 'Admin Layanan', className: styles.roleAdmin },
  };

  const roleInfo = roleMap[role] || { label: role, className: styles.roleDefault };
  return <span className={`${styles.roleBadge} ${roleInfo.className}`}>{roleInfo.label}</span>;
};

export default function UsersTab({
  users,
  onAddUser,
  onToggleUserActive,
}: UsersTabProps) {
  return (
    <div className={styles.usersSection}>
      <div className={styles.usersHeader}>
        <h3>👥 Daftar User di Cabang Ini</h3>
        <button className={styles.createUserBtn} onClick={onAddUser}>
          ➕ Tambah User
        </button>
      </div>

      {users.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <h3>Belum Ada User</h3>
          <p>Tambahkan user pertama untuk cabang ini</p>
          <button className={styles.createUserBtn} onClick={onAddUser}>
            ➕ Tambah User
          </button>
        </div>
      ) : (
        <div className={styles.usersGrid}>
          {users.map((u) => (
            <div key={u.id} className={styles.userCard}>
              <div className={styles.userHeader}>
                <div>
                  <h4>{u.profile.fullName}</h4>
                  <p className={styles.staffCode}>{u.staffCode}</p>
                </div>
                {getRoleBadge(u.role)}
              </div>

              <div className={styles.userBody}>
                <div className={styles.userInfo}>
                  <span className={styles.label}>Email:</span>
                  <span>{u.email}</span>
                </div>
                {u.profile.phone && (
                  <div className={styles.userInfo}>
                    <span className={styles.label}>Telepon:</span>
                    <span>{u.profile.phone}</span>
                  </div>
                )}
                <div className={styles.userInfo}>
                  <span className={styles.label}>Status:</span>
                  <span className={`${styles.userStatus} ${u.isActive ? styles.active : styles.inactive}`}>
                    {u.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                  </span>
                </div>
                {u.lastLoginAt && (
                  <div className={styles.userInfo}>
                    <span className={styles.label}>Login Terakhir:</span>
                    <span>{new Date(u.lastLoginAt).toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              <div className={styles.userActions}>
                <button
                  className={`${styles.actionBtn} ${u.isActive ? styles.deactivate : styles.activate}`}
                  onClick={() => onToggleUserActive(u.id, u.isActive)}
                >
                  {u.isActive ? '🚫 Nonaktifkan' : '✓ Aktifkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
