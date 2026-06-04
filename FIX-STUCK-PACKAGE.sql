-- FIX SCRIPT: Ubah status paket yang stuck dari PENDING_PAYMENT ke WAITING_VERIFICATION
-- Hanya untuk paket yang sudah ada paymentProofUrl tapi masih status PENDING_PAYMENT

-- 1. CEK DULU: Lihat paket yang stuck (sudah upload proof tapi masih PENDING_PAYMENT)
SELECT 
  id, 
  packageCode,
  status,
  paymentProofFileName,
  paymentProofUrl
FROM member_packages 
WHERE status = 'PENDING_PAYMENT' 
AND paymentProofUrl IS NOT NULL;

-- 2. FIX: Update status ke WAITING_VERIFICATION
-- UNCOMMENT LINE DIBAWAH SETELAH YAKIN DATA BENAR:
-- UPDATE member_packages 
-- SET status = 'WAITING_VERIFICATION'
-- WHERE status = 'PENDING_PAYMENT' 
-- AND paymentProofUrl IS NOT NULL;

-- 3. VERIFY: Cek hasil update
SELECT 
  id, 
  packageCode,
  status,
  paymentProofFileName
FROM member_packages 
WHERE id = 'cmpyyktru000aokuz8zzqhgh8';
