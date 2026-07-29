# Runbook Sprint 14 Zoho Go-live

## Boundary keselamatan

RAHO adalah sumber transaksi operasional. Zoho adalah adapter asynchronous.
Tidak ada controller/service pembelian paket, pembayaran, sesi terapi,
inventory, shipment, atau purchasing yang melakukan network call Zoho.

Jika Zoho tidak terhubung atau sedang outage:

1. transaksi RAHO tetap diposting;
2. outbox tetap tersimpan;
3. worker tidak melakukan write saat mode `OFF`;
4. event dapat diproses lagi setelah koneksi pulih;
5. jangan rollback transaksi lokal hanya karena Zoho gagal.

## Environment default aman

```env
ZOHO_SYNC_WORKER_ENABLED=false
ZOHO_SYNC_DRY_RUN=true
ZOHO_RECONCILIATION_ENABLED=false
ZOHO_RECONCILIATION_INTERVAL_MS=3600000
ZOHO_WEBHOOK_SECRET=
```

Nilai konfigurasi Zoho opsional yang kosong diperlakukan sebagai "belum
dikonfigurasi", sehingga API tetap dapat start. Runtime dipaksa ke `OFF` bila
worker tidak aktif atau kredensial yang dibutuhkan CANARY/LIVE tidak lengkap.

`ZOHO_WEBHOOK_SECRET` harus berupa nilai acak 12-100 karakter dan tidak boleh
masuk source control atau screenshot.

## Konfigurasi webhook

Endpoint:

```text
POST /api/v1/integrations/zoho/webhooks/{organization_id}
```

Konfigurasikan webhook Zoho Books dengan custom header:

```text
X-RAHO-Zoho-Webhook-Secret: <ZOHO_WEBHOOK_SECRET>
```

Payload user-defined minimal:

```json
{
  "organization_id": "${ORGANIZATION_ID}",
  "event_type": "invoice.updated",
  "entity_type": "invoice",
  "entity_id": "${INVOICE_ID}",
  "reference_number": "${REFERENCE_NUMBER}",
  "status": "${STATUS}",
  "total": "${TOTAL}"
}
```

Custom header dipakai karena webhook Zoho Books mendukung header dan secret
yang dikonfigurasi pengguna. Receiver juga menerima HMAC SHA-256 hex/base64 pada
`X-RAHO-Zoho-Signature` bila pengirim dikonfigurasi demikian.

## Urutan cutover

1. Deploy migration Sprint 13 dan 14.
2. Pastikan worker/reconciliation scheduler masih off.
3. Hubungkan Zoho dan jalankan discovery.
4. Selesaikan mapping master.
5. Buka tab **Go-live & Exception**.
6. Simpan control sehingga mode eksplisit menjadi `OFF`.
7. Freeze master integration.
8. Jalankan reconciliation penuh.
9. Selesaikan seluruh exception HIGH/CRITICAL dan dead-letter.
10. Simpan approval Finance dan Logistik.
11. Aktifkan `DRY_RUN`.
12. Review payload dan privacy.
13. Pilih satu cabang lalu aktifkan `CANARY`.
14. Rekonsiliasi setiap hari dan catat lima hari kerja bebas mismatch.
15. Aktifkan `LIVE`.

Event yang telah diperiksa saat `DRY_RUN` dikembalikan ke status `PENDING`
ketika promosi ke `CANARY/LIVE`; rehearsal tidak menghilangkan transaksi yang
masih wajib dikirim. Satu hari observasi hanya dapat dicatat sekali pada hari
kerja zona waktu Asia/Jakarta.

## Rollback

Klik **Rollback OFF** dan isi alasan. Dampaknya:

- worker berhenti mengambil event baru;
- event lokal tidak dihapus;
- transaksi ERP tetap berjalan;
- tidak ada reversal otomatis di Zoho;
- reconciliation dan investigasi tetap tersedia.

Rollback tidak boleh menjalankan delete, void, atau reversal otomatis.

## Penanganan insiden

### Zoho tidak terhubung

- biarkan mode `OFF`;
- lanjutkan operasional RAHO;
- hubungkan kembali hanya melalui SUPER_ADMIN;
- jalankan reconciliation sebelum CANARY/LIVE.

### Rate-limit atau outage

- run berubah menjadi `PAUSED`;
- cursor terakhir tersimpan;
- scheduler/manual run melanjutkan run yang sama;
- jangan membuat run paralel atau mengulang transaksi lokal.

### Webhook invalid

- signature salah: `401`;
- organization tidak dikenal/tidak cocok: `403`;
- JSON invalid: `400`;
- event unknown: inbox `IGNORED`;
- mapping belum ada: `PENDING_CORRELATION`.

### Drift manual di Zoho

- exception berstatus `DRIFT/MISMATCH`;
- tentukan apakah RAHO atau Zoho yang benar;
- koreksi melalui flow resmi;
- isi resolution note;
- jangan menghapus evidence webhook/reconciliation.

## Smoke test lokal tanpa Zoho

Dengan koneksi Zoho diputus dan mode `OFF`, buktikan:

1. pembelian paket dan uang muka sukses;
2. pembayaran/verifikasi sukses;
3. sesi terapi dapat diselesaikan;
4. revenue/HPP/FIFO lokal tetap terposting;
5. cancellation treatment tetap reversal lokal;
6. stock request, shipment, goods receipt, dan opname sukses;
7. purchase order, supplier invoice, dan supplier payment sukses;
8. tidak ada network error Zoho pada response transaksi lokal.
