/**
 * Format number dengan titik setiap 3 digit (thousand separator)
 * @param num - Angka yang akan diformat
 * @returns String dengan format "1.000.000"
 */
export function formatNumberWithDots(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format currency untuk Indonesia (Rp dengan titik setiap 3 digit)
 * @param num - Angka yang akan diformat
 * @returns String dengan format "Rp 1.000.000"
 */
export function formatCurrency(num: number): string {
  return `Rp ${formatNumberWithDots(num)}`;
}
