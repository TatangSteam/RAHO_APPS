import styles from './page.module.css';

interface TabNavigationProps {
  activeTab: 'overview' | 'users' | 'members';
  usersCount: number;
  membersCount: number;
  onTabChange: (tab: 'overview' | 'users' | 'members') => void;
}

export default function TabNavigation({
  activeTab,
  usersCount,
  membersCount,
  onTabChange,
}: TabNavigationProps) {
  return (
    <div className={styles.tabs}>
      <button
        className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
        onClick={() => onTabChange('overview')}
      >
        📋 Informasi Cabang
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
        onClick={() => onTabChange('users')}
      >
        👥 Kelola User ({usersCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'members' ? styles.active : ''}`}
        onClick={() => onTabChange('members')}
      >
        🧑‍⚕️ Kelola Member ({membersCount})
      </button>
    </div>
  );
}
