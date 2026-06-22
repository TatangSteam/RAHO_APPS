import { BranchInventoryItem } from './types';
import styles from './page.module.css';

interface StockTabProps {
  inventory: BranchInventoryItem[];
  branchName: string;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export default function StockTab({ inventory, branchName }: StockTabProps) {
  const lowStockCount = inventory.filter((item) => item.isLowStock).length;
  const totalStock = inventory.reduce((sum, item) => sum + Number(item.stock || 0), 0);

  return (
    <div className={styles.stockSection}>
      <div className={styles.stockHeader}>
        <div>
          <h3>Stok Cabang</h3>
          <p>Daftar stok aktif yang tersedia di {branchName}</p>
        </div>
        <div className={styles.stockSummary}>
          <div className={styles.stockSummaryItem}>
            <span>Total Item</span>
            <strong>{inventory.length}</strong>
          </div>
          <div className={styles.stockSummaryItem}>
            <span>Stok Rendah</span>
            <strong className={lowStockCount > 0 ? styles.stockDangerText : ''}>{lowStockCount}</strong>
          </div>
          <div className={styles.stockSummaryItem}>
            <span>Total Stok</span>
            <strong>{formatNumber(totalStock)}</strong>
          </div>
        </div>
      </div>

      {inventory.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>ST</div>
          <h3>Belum Ada Stok</h3>
          <p>Cabang ini belum memiliki data stok inventori.</p>
        </div>
      ) : (
        <div className={styles.stockTableWrap}>
          <table className={styles.stockTable}>
            <thead>
              <tr>
                <th>Nama Item</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Minimum</th>
                <th>Lokasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.stockItemName}>
                      <strong>{item.name}</strong>
                      <span>{item.baseUnit} / {item.usageUnit}</span>
                    </div>
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <strong>{item.stockDisplay || `${formatNumber(item.stock)} ${item.baseUnit}`}</strong>
                  </td>
                  <td>{item.thresholdDisplay || `${formatNumber(item.minThreshold)} ${item.baseUnit}`}</td>
                  <td>{item.storageLocation || '-'}</td>
                  <td>
                    <span className={`${styles.stockStatus} ${item.isLowStock ? styles.stockLow : styles.stockNormal}`}>
                      {item.isLowStock ? 'Stok Rendah' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
