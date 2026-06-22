import styles from './page.module.css';

interface TabNavigationProps {
  activeTab: 'overview' | 'users' | 'members' | 'stock';
  usersCount: number;
  membersCount: number;
  stockCount: number;
  onTabChange: (tab: 'overview' | 'users' | 'members' | 'stock') => void;
}

export default function TabNavigation({
  activeTab,
  usersCount,
  membersCount,
  stockCount,
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
      <button
        className={`${styles.tab} ${activeTab === 'stock' ? styles.active : ''}`}
        onClick={() => onTabChange('stock')}
      >
        Stok ({stockCount})
      </button>
    </div>
  );
}
