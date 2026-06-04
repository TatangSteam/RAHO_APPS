-- DEBUG QUERY: Cek status paket yang error verify
-- Package ID dari error log: cmpyyktru000aokuz8zzqhgh8

SELECT 
  id, 
  packageCode,
  packageType,
  status,
  finalPrice,
  paymentProofUrl,
  paymentProofFileName,
  paymentProofFileSize,
  paidAt,
  verifiedAt,
  rejectedAt,
  rejectionReason,
  createdAt,
  updatedAt
FROM member_packages 
WHERE id = 'cmpyyktru000aokuz8zzqhgh8';

-- Jika paket sudah di-verify (status = ACTIVE), cek invoicenya:
SELECT 
  i.id,
  i.invoiceNumber,
  i.status AS invoice_status,
  i.totalAmount,
  i.paidAt,
  p.amount AS payment_amount,
  p.proofFileName
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoiceId
WHERE i.id IN (
  SELECT invoiceId FROM invoice_items WHERE itemId = 'cmpyyktru000aokuz8zzqhgh8'
);

-- Cek apakah ada paket lain dengan purchaseGroupId yang sama:
SELECT 
  id,
  packageCode,
  packageType,
  status,
  purchaseGroupId,
  paymentProofFileName
FROM member_packages 
WHERE purchaseGroupId = (
  SELECT purchaseGroupId FROM member_packages WHERE id = 'cmpyyktru000aokuz8zzqhgh8'
)
AND purchaseGroupId IS NOT NULL;

-- Summary status semua paket member ini:
SELECT 
  mp.status,
  COUNT(*) as jumlah,
  GROUP_CONCAT(mp.packageCode) as package_codes
FROM member_packages mp
WHERE mp.memberId = (
  SELECT memberId FROM member_packages WHERE id = 'cmpyyktru000aokuz8zzqhgh8'
)
GROUP BY mp.status;
