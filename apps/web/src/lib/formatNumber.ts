/**
 * Format number dengan titik setiap 3 digit (thousand separator)
 * @param num - Angka yang akan diformat. Nilai kosong/tidak valid ditampilkan sebagai 0.
 * @returns String dengan format "1.000.000"
 */
export function formatNumberWithDots(num?: number | null): string {
  const safeNumber = typeof num === 'number' && Number.isFinite(num) ? num : 0;
  return String(safeNumber).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format currency untuk Indonesia (Rp dengan titik setiap 3 digit)
 * @param num - Angka yang akan diformat. Nilai kosong/tidak valid ditampilkan sebagai 0.
 * @returns String dengan format "Rp 1.000.000"
 */
export function formatCurrency(num?: number | null): string {
  return `Rp ${formatNumberWithDots(num)}`;
}
