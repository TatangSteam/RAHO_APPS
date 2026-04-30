'use client';

import styles from './TopStaff.module.css';

interface StaffMember {
  staffId: string;
  staffCode: string;
  name: string;
  role: string;
  sessionsCompleted: number;
}

interface TopStaffProps {
  staff: StaffMember[];
}

const roleLabels: Record<string, string> = {
  DOCTOR: 'Dokter',
  NURSE: 'Nakes',
  ADMIN_LAYANAN: 'Admin Layanan',
  ADMIN_CABANG: 'Admin Cabang',
};

export default function TopStaff({ staff }: TopStaffProps) {
  if (!staff || staff.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>👨‍⚕️ Top Staff</h3>
        <div className={styles.empty}>
          <p>Belum ada data staff</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>👨‍⚕️ Top Staff</h3>
      <p className={styles.subtitle}>Berdasarkan sesi yang diselesaikan</p>
      
      <div className={styles.list}>
        {staff.map((member, index) => (
          <div key={member.staffId} className={styles.item}>
            <div className={styles.rank}>
              {index === 0 && '🥇'}
              {index === 1 && '🥈'}
              {index === 2 && '🥉'}
              {index > 2 && `#${index + 1}`}
            </div>
            <div className={styles.info}>
              <p className={styles.name}>{member.name}</p>
              <p className={styles.role}>
                {roleLabels[member.role] || member.role} • {member.staffCode}
              </p>
            </div>
            <div className={styles.count}>
              <span className={styles.sessions}>{member.sessionsCompleted}</span>
              <span className={styles.label}>sesi</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
