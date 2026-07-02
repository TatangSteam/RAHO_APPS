---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Clean Code & Redundancy Rules

## Mode Kerja
- Selalu gunakan Plan Mode dulu untuk memetakan file yang akan disentuh sebelum Act Mode mengubah kode.
- Jangan langsung menulis ulang seluruh file besar; ajukan diff per bagian jika perubahan >50 baris.
- Jika ragu apakah sebuah fungsi/kode masih dipakai (dynamic import, DI, config-driven), tandai sebagai MANUAL_VERIFY, jangan langsung hapus.

## Prinsip Wajib
- Terapkan DRY: jika logic yang sama muncul di lebih dari 2 tempat, ekstrak jadi util/hook/service reusable.
- Terapkan Single Responsibility: fungsi/komponen yang >50 baris atau menangani >1 concern harus dipecah.
- Hapus dead code: import tidak terpakai, variabel tak terbaca, console.log/debugger, kode dikomentari, feature flag mati.
- Konsolidasikan validasi (Zod/Yup) di satu layer shared antara frontend dan backend jika stack mendukung.
- Query database (Prisma) harus select field spesifik, hindari N+1, gunakan `include`/`select` eksplisit.
- Frontend React/Next.js: hindari re-render tidak perlu, gunakan `useMemo`/`useCallback` hanya jika terbukti perlu (jangan over-optimize).

## Batasan Keras
- Jangan pernah mengubah behavior, response API, atau output UI tanpa konfirmasi eksplisit.
- Jangan menambah dependency baru tanpa menyebutkan alasan dan meminta persetujuan.
- Jangan menghapus kode yang dipakai lewat reflection/DI/config tanpa verifikasi manual.
- Setelah refactor, jalankan test yang tersedia (`npm test` / `npm run test:e2e`) sebelum menandai task selesai.

## Format Laporan Setelah Refactor
Setiap selesai membersihkan satu file/modul, laporkan dalam format:
- File yang diubah
- Redundansi/inefisiensi yang ditemukan (dengan line number)
- Perubahan yang dilakukan
- Status test (pass/fail)