# BPMN Aplikasi RAHO ERP Management System

Dokumen ini berisi pemodelan proses bisnis utama RAHO ERP dalam format Markdown dengan diagram Mermaid. Notasi dibuat bergaya BPMN dengan pool/lane, event, activity, gateway, dan data object agar mudah dibaca di GitHub, GitLab, atau VS Code extension yang mendukung Mermaid.

Tanggal penyusunan: 17 Juli 2026.

## Daftar Isi

1. [Legenda Notasi](#1-legenda-notasi)
2. [BPMN Level 0 - End-to-End Operasional Klinik](#2-bpmn-level-0---end-to-end-operasional-klinik)
3. [BPMN Member Registration dan Import](#3-bpmn-member-registration-dan-import)
4. [BPMN Paket, Invoice, dan Pembayaran](#4-bpmn-paket-invoice-dan-pembayaran)
5. [BPMN Sesi Terapi dan EMR](#5-bpmn-sesi-terapi-dan-emr)
6. [BPMN Inventory, Stock Request, dan Shipment](#6-bpmn-inventory-stock-request-dan-shipment)
7. [BPMN Homecare Logistics](#7-bpmn-homecare-logistics)
8. [BPMN Referral dan Insentif](#8-bpmn-referral-dan-insentif)
9. [BPMN Communication, Audit, dan Governance](#9-bpmn-communication-audit-dan-governance)
10. [Catatan Implementasi](#10-catatan-implementasi)

## 1. Legenda Notasi

| Simbol | Arti |
| --- | --- |
| `((Start))` | Start event |
| `((End))` | End event |
| `[Activity]` | Task/activity |
| `{Gateway?}` | Decision/exclusive gateway |
| `[(Data)]` | Data object atau database record |
| `subgraph Lane` | Pool/lane aktor atau sistem |
| Garis solid | Sequence flow |
| Garis putus-putus | Data/audit/notification side effect |

Catatan: Mermaid tidak menyediakan notasi BPMN native lengkap. Karena itu, diagram di dokumen ini memakai `flowchart` sebagai representasi BPMN yang praktis untuk dokumentasi teknis.

## 2. BPMN Level 0 - End-to-End Operasional Klinik

Diagram ini menggambarkan proses besar dari setup sistem, registrasi member, pembelian paket, terapi, konsumsi stok, pembayaran, hingga audit.

```mermaid
flowchart LR
    START((Mulai))
    END((Selesai))

    subgraph ADMIN["Lane: Super Admin / Admin Manager"]
        A1[Setup cabang]
        A2[Setup role, staff, manager]
        A3[Setup harga paket dan master produk]
        A4[Monitor dashboard, audit log, performa cabang]
    end

    subgraph FRONT["Lane: Admin Cabang / Admin Layanan"]
        F1[Registrasi atau import member]
        F2[Kelola data member dan dokumen]
        F3[Assign paket dan add-on]
        F4[Create sesi terapi]
        F5[Kelola invoice dan pembayaran]
    end

    subgraph CLINIC["Lane: Dokter / Nurse"]
        C1[Input diagnosis]
        C2[Buat atau review therapy plan]
        C3[Catat vital sign awal]
        C4[Eksekusi terapi dan booster]
        C5[Catat material usage]
        C6[Upload foto dan evaluasi]
        C7[Complete session]
    end

    subgraph LOGISTIC["Lane: Inventory / Logistics"]
        L1[Monitor stok cabang]
        L2[Request stok]
        L3[Approve dan proses shipment]
        L4[Receive stok]
        L5[Stock mutation dan overstock]
    end

    subgraph SYSTEM["Lane: Sistem RAHO ERP"]
        S1[(Database RAHO)]
        S2[Generate nomor dokumen]
        S3[Create audit log]
        S4[Kirim notifikasi]
        S5[Hitung referral incentive]
    end

    START --> A1 --> A2 --> A3 --> F1 --> F2 --> F3 --> F5
    F3 --> F4 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7 --> END
    C5 --> L1
    L1 --> L2 --> L3 --> L4 --> L5
    F5 --> S5
    A1 -.-> S1
    F1 -.-> S1
    F3 -.-> S2
    C7 -.-> S3
    L5 -.-> S3
    S3 -.-> A4
    S4 -.-> F2
```

## 3. BPMN Member Registration dan Import

Proses ini mencakup registrasi manual member dan import Excel. Output utamanya adalah user `MEMBER`, profile, data member, nomor member, akses cabang, dokumen, dan audit log.

```mermaid
flowchart TB
    START((Start))
    END((Member aktif))

    subgraph STAFF["Lane: Admin Layanan / Admin Cabang / Admin Manager"]
        M1[Pilih menu Member]
        M2{Metode input?}
        M3[Input form member baru]
        M4[Upload file Excel import]
        M5[Review hasil dry-run import]
        M6[Submit registrasi atau execute import]
    end

    subgraph VALIDATION["Lane: Validasi Sistem"]
        V1[Validasi role dan akses cabang]
        V2[Validasi data wajib]
        V3[Cek username/email unik]
        V4[Cek NIK atau identity unik]
        V5[Cek kombinasi nama dan tanggal lahir]
        V6{Data valid?}
    end

    subgraph DATA["Lane: Database"]
        D1[(User role MEMBER)]
        D2[(UserProfile)]
        D3[(Member)]
        D4[(BranchMemberAccess)]
        D5[(MemberDocument)]
        D6[(AuditLog)]
        D7[(Notification)]
    end

    START --> M1 --> M2
    M2 -->|Manual| M3 --> M6
    M2 -->|Import Excel| M4 --> V2 --> M5 --> M6
    M6 --> V1 --> V2 --> V3 --> V4 --> V5 --> V6
    V6 -->|Tidak| E1[Return validation error] --> M3
    V6 -->|Ya| G1[Generate memberNo]
    G1 --> G2[Resolve identity number]
    G2 --> D1 --> D2 --> D3 --> D4
    D3 --> D5
    D3 --> D6
    D3 --> D7
    D7 --> END
```

### Business Rules

| Rule | Penjelasan |
| --- | --- |
| Member number | Digenerate otomatis dengan pola `MBR-{BRANCH}-{YYMM}-{SEQ}`. |
| NIK/identity | Jika tersedia, harus unik pada tabel member. |
| Duplicate person guard | Nama dan tanggal lahir yang sama dianggap potensi member duplicate. |
| Import valid rows | Baris valid diproses; baris invalid masuk daftar skipped. |
| Branch access | Member dibuat dengan `registrationBranchId` dan `BranchMemberAccess` untuk cabang terkait. |

## 4. BPMN Paket, Invoice, dan Pembayaran

Proses ini mencakup assign paket, generate invoice, upload bukti bayar, verifikasi, aktivasi paket, refund, dan cancel.

```mermaid
flowchart TB
    START((Start))
    END((End))

    subgraph STAFF["Lane: Admin Layanan / Admin Cabang"]
        P1[Buka detail member]
        P2[Assign package]
        P3[Pilih basic package]
        P4[Pilih booster package atau add-on]
        P5[Input harga, diskon, dan service type]
        P6[Upload bukti pembayaran]
        P7[Verifikasi pembayaran]
        P8[Reject pembayaran]
        P9[Edit / cancel / refund paket]
    end

    subgraph SYSTEM["Lane: Sistem Billing"]
        S1[Validasi akses member dan cabang]
        S2[Hitung total, diskon, final price]
        S3[Create MemberPackage]
        S4[Generate invoice PENDING]
        S5{Pembayaran valid?}
        S6[Set package ACTIVE]
        S7[Set invoice PAID]
        S8[Create incentive record jika ada referral]
        S9[Update status rejected/cancelled/refunded]
    end

    subgraph DATA["Lane: Data Object"]
        D1[(MemberPackage)]
        D2[(Invoice)]
        D3[(PaymentProof)]
        D4[(ReferralIncentiveRecord)]
        D5[(AuditLog)]
    end

    START --> P1 --> P2 --> S1 --> P3 --> P4 --> P5 --> S2 --> S3 --> S4
    S3 --> D1
    S4 --> D2
    S4 --> P6 --> D3 --> P7 --> S5
    S5 -->|Ya| S6 --> S7 --> S8 --> END
    S8 --> D4
    S5 -->|Tidak| P8 --> S9 --> END
    S4 --> P9 --> S9 --> END
    S6 -.-> D5
    S9 -.-> D5
```

### Status Utama

| Entity | Status | Makna |
| --- | --- | --- |
| Package | `PENDING_PAYMENT` | Paket sudah dibuat, belum aktif. |
| Package | `ACTIVE` | Paket dapat dipakai sesi terapi. |
| Package | `CANCELLED` | Paket dibatalkan. |
| Package | `REFUNDED` | Paket dikembalikan sesuai proses refund. |
| Invoice | `PENDING` | Tagihan belum lunas. |
| Invoice | `PAID` | Pembayaran sudah diverifikasi. |

## 5. BPMN Sesi Terapi dan EMR

Proses terapi mengikuti workflow klinis multi-step: create session, diagnosis, therapy plan, vital sign, booster, infusion, material usage, foto, evaluasi, completion.

```mermaid
flowchart TB
    START((Start))
    END((Session completed))

    subgraph ADMIN["Lane: Admin Layanan"]
        A1[Pilih member]
        A2[Cek paket aktif dan sisa sesi]
        A3[Create treatment session]
        A4[Monitor progress session]
    end

    subgraph DOCTOR["Lane: Dokter"]
        D1[Input diagnosis]
        D2[Buat/review therapy plan]
        D3[Evaluasi dokter]
        D4[Catat rekomendasi]
    end

    subgraph NURSE["Lane: Nurse"]
        N1[Catat vital sign sebelum terapi]
        N2[Input booster]
        N3[Catat eksekusi infus]
        N4[Catat material usage]
        N5[Upload foto sesi]
        N6[Catat vital sign sesudah terapi]
    end

    subgraph SYSTEM["Lane: Sistem EMR"]
        S1[Validasi role dan akses branch]
        S2[Lock/track step progress]
        S3[Deduct session quota]
        S4[Deduct inventory stock]
        S5[Generate EMR summary]
        S6[Create audit log]
    end

    START --> A1 --> A2 --> G1{Paket aktif tersedia?}
    G1 -->|Tidak| E1[Stop: assign/aktifkan paket dulu]
    G1 -->|Ya| A3 --> S1 --> D1 --> D2 --> N1 --> N2 --> N3 --> N4 --> N5 --> N6 --> D3 --> D4
    D4 --> S2 --> S3 --> S4 --> S5 --> S6 --> END
    A4 -.-> S2
```

### Step Operasional Sesi

| Step | Aktor utama | Output |
| --- | --- | --- |
| Diagnosis | Dokter/Admin layanan sesuai izin | Member/session diagnosis |
| Therapy plan | Dokter/Admin layanan sesuai izin | Therapy plan set dan detail dosis |
| Vital before | Nurse | Vital signs awal |
| Booster | Nurse/Admin layanan | Booster package usage |
| Infusion | Nurse | Infusion execution data |
| Material usage | Nurse | Penggunaan barang dan mutasi stok |
| Photo | Nurse/Admin layanan | Session photo/supporting document |
| Vital after | Nurse | Vital signs akhir |
| Evaluation | Dokter | Evaluasi dan rekomendasi |

## 6. BPMN Inventory, Stock Request, dan Shipment

Proses ini mencakup stok cabang, request stok, approval, shipment, receive, discrepancy, dan overstock.

```mermaid
flowchart TB
    START((Start))
    END((Stock updated))

    subgraph BRANCH["Lane: Admin Cabang / Nurse"]
        B1[Monitor stock cabang]
        B2{Stock cukup?}
        B3[Create stock request]
        B4[Receive shipment]
        B5[Catat discrepancy jika ada]
    end

    subgraph MANAGER["Lane: Admin Manager / Super Admin"]
        M1[Review stock request]
        M2{Approve request?}
        M3[Reject request]
        M4[Create shipment]
        M5[Ship stock]
    end

    subgraph SYSTEM["Lane: Sistem Inventory"]
        S1[Cek master product dan conversion unit]
        S2[Cek overstock available]
        S3[Reserve/deduct source stock]
        S4[Create stock mutation]
        S5[Add destination stock]
        S6[Update shipment status]
        S7[Create audit log]
    end

    subgraph DATA["Lane: Data Object"]
        D1[(InventoryItem)]
        D2[(StockRequest)]
        D3[(Shipment)]
        D4[(StockMutation)]
        D5[(Overstock)]
    end

    START --> B1 --> B2
    B2 -->|Ya| END
    B2 -->|Tidak| B3 --> S1 --> S2 --> D2 --> M1 --> M2
    M2 -->|Tidak| M3 --> S7 --> END
    M2 -->|Ya| M4 --> D3 --> M5 --> S3 --> S4 --> B4
    B4 --> G1{Ada discrepancy?}
    G1 -->|Ya| B5 --> S5
    G1 -->|Tidak| S5
    S5 --> S6 --> S7 --> END
    S4 --> D4
    S2 --> D5
    S5 --> D1
```

### Business Rules

| Rule | Penjelasan |
| --- | --- |
| Stock mutation | Semua adjustment, shipment, receive, dan material usage menghasilkan mutasi stok. |
| Unit conversion | Stok dapat dibaca dalam base unit dan usage unit. |
| Overstock | Overstock dapat dipakai sebagai sumber pemenuhan request sesuai perhitungan sistem. |
| Receive discrepancy | Perbedaan jumlah diterima harus dicatat saat receive. |

## 7. BPMN Homecare Logistics

Proses homecare berhubungan dengan tas homecare, penyiapan barang, serah terima, penggunaan, dan rekonsiliasi stok.

```mermaid
flowchart TB
    START((Start))
    END((Homecare closed))

    subgraph ADMIN["Lane: Admin Cabang / Admin Layanan"]
        A1[Terima kebutuhan homecare]
        A2[Jadwalkan layanan homecare]
        A3[Assign team dan tas homecare]
    end

    subgraph LOGISTIC["Lane: Logistics / Inventory"]
        L1[Siapkan isi tas homecare]
        L2[Validasi stok dan batch]
        L3[Serah terima tas ke team]
        L4[Terima kembali tas]
        L5[Opname isi tas]
    end

    subgraph TEAM["Lane: Team Homecare"]
        T1[Bawa tas ke lokasi member]
        T2[Laksanakan terapi]
        T3[Catat material usage]
        T4[Upload bukti/foto layanan]
        T5[Kembalikan tas]
    end

    subgraph SYSTEM["Lane: Sistem"]
        S1[Deduct stock ke tas/homecare]
        S2[Catat usage dan sisa barang]
        S3[Reconcile stok cabang]
        S4[Create audit log]
    end

    START --> A1 --> A2 --> A3 --> L1 --> L2 --> S1 --> L3 --> T1 --> T2 --> T3 --> T4 --> T5 --> L4 --> L5 --> S2 --> S3 --> S4 --> END
```

## 8. BPMN Referral dan Insentif

Referral dipakai untuk mencatat sumber akuisisi member dan menghitung insentif saat pembayaran paket diverifikasi.

```mermaid
flowchart TB
    START((Start))
    END((Incentive recorded))

    subgraph ADMIN["Lane: Admin Cabang / Admin Manager"]
        A1[Buat referral code]
        A2[Set referrer dan tipe referral]
        A3[Set incentive rule]
        A4[Assign referral ke member]
        A5[Export/report incentive]
    end

    subgraph BILLING["Lane: Billing Process"]
        B1[Member membeli paket]
        B2[Verifikasi pembayaran]
        B3{Member punya referral?}
    end

    subgraph SYSTEM["Lane: Sistem Referral"]
        S1[Validasi referral aktif]
        S2[Hitung first/next incentive]
        S3[Create incentive record]
        S4[Update referral statistics]
        S5[Create audit log]
    end

    START --> A1 --> A2 --> A3 --> A4 --> B1 --> B2 --> B3
    B3 -->|Tidak| END
    B3 -->|Ya| S1 --> S2 --> S3 --> S4 --> S5 --> A5 --> END
```

## 9. BPMN Communication, Audit, dan Governance

Proses governance berjalan sebagai side process di banyak workflow: autentikasi, otorisasi, audit, notifikasi, file access, dan impersonation.

```mermaid
flowchart TB
    START((Request masuk))
    END((Response dikirim))

    subgraph USER["Lane: User"]
        U1[Login]
        U2[Akses menu/fitur]
        U3[Upload/download file]
        U4[Terima notifikasi]
    end

    subgraph SECURITY["Lane: Security Middleware"]
        S1[Authenticate JWT]
        S2[Authorize role]
        S3[Assert branch access]
        S4[Validate payload]
    end

    subgraph APP["Lane: Application Service"]
        A1[Jalankan business service]
        A2{Perubahan data?}
        A3[Create/update/delete data]
        A4[Read data]
    end

    subgraph GOVERNANCE["Lane: Governance"]
        G1[Create audit log]
        G2[Create notification]
        G3[Serve protected file]
        G4[Impersonation start/stop]
    end

    START --> U1 --> S1 --> U2 --> S2 --> S3 --> S4 --> A1 --> A2
    A2 -->|Ya| A3 --> G1 --> G2 --> END
    A2 -->|Tidak| A4 --> END
    U3 --> S1 --> G3 --> END
    G4 -.-> G1
    G2 -.-> U4
```

### Governance Rules

| Area | Rule |
| --- | --- |
| Authentication | Semua endpoint staff/member dilindungi JWT kecuali endpoint publik tertentu. |
| Authorization | Akses fitur dibatasi role: Super Admin, Admin Manager, Admin Cabang, Admin Layanan, Dokter, Nurse, Member. |
| Branch scope | Data operasional cabang mengikuti `branchId`, managed branches, atau branch access. |
| Audit | Perubahan penting seperti create/update/delete, payment verification, stock mutation, dan impersonation dicatat. |
| File access | Dokumen dan foto disajikan lewat endpoint file yang tetap memeriksa user/session. |

## 10. Catatan Implementasi

| Domain | Modul utama |
| --- | --- |
| Identity dan role | `auth`, `users`, `admin`, middleware auth/authorize |
| Cabang | `branches`, `admin-manager` |
| Member dan referral | `members`, `referrals` |
| Paket, invoice, billing | `packages`, `invoices`, `non-therapy` |
| Clinical dan EMR | `treatment-sessions`, `diagnosis`, therapy plan services |
| Inventory dan logistics | `inventory`, stock request, shipment, overstock |
| Member portal | `me` |
| Governance | `audit-logs`, notifications, file serving, impersonation |

Dokumen pendukung:

- `docs/BUSINESS-FLOW.md`
- `docs/UML-APLIKASI.md`
- `docs/MODULES-BY-ROLE.md`
- `docs/CORE-IDENTITY-AND-BRANCH.md`
- `docs/MEMBER-AND-REFERRAL.md`
- `docs/03-COMMERCIAL-AND-BILLING.md`
- `docs/04-CLINICAL-AND-EMR.md`
- `docs/05-INVENTORY-AND-LOGISTICS.md`
- `docs/06-HOMECARE-LOGISTICS.md`
- `docs/07-COMMUNICATION-AND-GOVERNANCE.md`
