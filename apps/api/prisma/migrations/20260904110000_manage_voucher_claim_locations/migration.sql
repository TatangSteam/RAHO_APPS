ALTER TABLE "voucher_claim_locations"
ADD COLUMN "locationGroup" TEXT NOT NULL DEFAULT 'PARTNER';

UPDATE "voucher_claim_locations"
SET "locationGroup" = 'RAHO_PREMIER'
WHERE LOWER("displayName") LIKE '%raho%premier%';

INSERT INTO "voucher_claim_locations" (
    "id", "code", "displayName", "locationGroup", "city", "address", "phone",
    "sourceReference", "dataCompletenessStatus", "createdBy", "updatedBy", "updatedAt"
) VALUES
('VCL-REG-001', 'RAHO-REG-CITRALAND', 'RAHO Citraland', 'RAHO_REGULER', 'Surabaya', 'Ruko North Junction RC-08, Jl. Raya Taman Puspa Citraland, Surabaya', '0812-1456-7588', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-002', 'RAHO-REG-METROPOLIS', 'RAHO Metropolis', 'RAHO_REGULER', 'Surabaya', 'Apartemen Metropolis Lt. 3 Tower B Ruang B 301, Jl. Raya Tenggilis 127, Surabaya', '0819-0181-9888', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-003', 'RAHO-REG-ARMADA', 'RAHO Armada', 'RAHO_REGULER', 'Surabaya', 'Jl. Perak Timur No. 190C, Surabaya', '0822-4593-6469', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-004', 'RAHO-REG-DARMO-HILL', 'RAHO Premier Darmo Hill', 'RAHO_REGULER', 'Surabaya', 'Jl. Pakis Argosari No. 45, Dukuh Pakis, Kec. Dukuhpakis, Surabaya, Jawa Timur', '0821-3165-5825', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-005', 'RAHO-REG-JAKSA-AGUNG', 'RAHO Premier Jaksa Agung', 'RAHO_REGULER', 'Surabaya', 'Jl. Jaksa Agung Suprapto No. 7, Ketabang, Kec. Genteng, Surabaya, Jawa Timur', '0812-6361-3777', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-006', 'RAHO-REG-BANJARMASIN', 'RAHO Banjarmasin', 'RAHO_REGULER', 'Banjarmasin', 'Jl. Belitung Darat No. 35, Belitung Selatan, Kec. Banjarmasin Barat, Kota Banjarmasin, Kalimantan Selatan 70123', '0813-3016-991', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-007', 'RAHO-REG-BOGOR', 'RAHO Bogor', 'RAHO_REGULER', 'Bogor', 'Jl. Siliwangi No. 25A, Kp. Parung Jambu, Batutulis', '0857-9591-1078', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-008', 'RAHO-REG-MALANG', 'RAHO Malang', 'RAHO_REGULER', 'Malang', 'Mall Eplico No. 23, Villa Puncak Tidar, Kabupaten Malang', '0823-3292-2886', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-009', 'RAHO-REG-TULUNGAGUNG', 'RAHO Tulungagung', 'RAHO_REGULER', 'Tulungagung', 'Jl. A. Yani Timur, Kel. Kampung Dalem No. 80, Tulungagung', '0822-4530-9343', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-010', 'RAHO-REG-SOLO', 'RAHO Solo', 'RAHO_REGULER', 'Solo', 'Jl. Slamet Riyadi No. 119, Kemlayan, Kec. Serengan', '0815-4801-0918', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-011', 'RAHO-REG-KELAPA-GADING', 'RAHO Kelapa Gading', 'RAHO_REGULER', 'Jakarta', 'Jl. Giring Giring V-7, Kelapa Gading', '0821-2587-6067', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-012', 'RAHO-REG-BSD-TANGERANG', 'RAHO BSD/Tangerang', 'RAHO_REGULER', 'Tangerang Selatan', 'Komplek Ruko WTC Matahari Serpong No. 910 & 912, Jl. Raya Serpong No. 39, RT.001/RW.007, Kel. Pondok Jagung, Kec. Serpong Utara, Kota Tangerang Selatan, Banten 15326', '0852-1134-6870', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-013', 'RAHO-REG-PIK2', 'RAHO PIK2', 'RAHO_REGULER', 'Tangerang', 'PIK 2 Ruko Shibuya STB/09, Kel. Lemo, Kec. Teluk Naga, Kab. Tangerang', '0852-8183-6408', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-REG-014', 'RAHO-REG-LIPPO-NUSANTARA', 'RAHO Lippo Mall Nusantara', 'RAHO_REGULER', 'Jakarta', 'Jl. Jend. Sudirman, RT.1/RW.4, Karet Semanggi, Kec. Setiabudi, Kota Jakarta Selatan 12930, Gedung Veteran RI Lantai 6', '813-1987-787', 'Daftar lokasi RAHO Reguler 2026-09-04', 'COMPLETE', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP);

-- Pertahankan arti akun operator yang sebelumnya ditugaskan ke seluruh 20
-- lokasi awal: operator tersebut otomatis menerima seluruh lokasi reguler baru.
INSERT INTO "voucher_operator_locations" (
    "id", "userId", "locationId", "assignedBy", "assignedAt", "validUntil"
)
SELECT
    'VOL-REG-' || MD5(scope."userId" || location."id"),
    scope."userId",
    location."id",
    'SYSTEM',
    CURRENT_TIMESTAMP,
    scope."validUntil"
FROM (
    SELECT
        assignment."userId",
        CASE
            WHEN COUNT(*) FILTER (WHERE assignment."validUntil" IS NULL) > 0 THEN NULL
            ELSE MIN(assignment."validUntil")
        END AS "validUntil"
    FROM "voucher_operator_locations" assignment
    WHERE assignment."locationId" IN (
        'VCL-001', 'VCL-002', 'VCL-003', 'VCL-004', 'VCL-005',
        'VCL-006', 'VCL-007', 'VCL-008', 'VCL-009', 'VCL-010',
        'VCL-011', 'VCL-012', 'VCL-013', 'VCL-014', 'VCL-015',
        'VCL-016', 'VCL-017', 'VCL-018', 'VCL-019', 'VCL-020'
    )
    GROUP BY assignment."userId"
    HAVING COUNT(DISTINCT assignment."locationId") = 20
) scope
CROSS JOIN "voucher_claim_locations" location
WHERE location."locationGroup" = 'RAHO_REGULER'
ON CONFLICT ("userId", "locationId") DO NOTHING;

CREATE INDEX "voucher_claim_locations_locationGroup_city_isActive_idx"
ON "voucher_claim_locations"("locationGroup", "city", "isActive");
