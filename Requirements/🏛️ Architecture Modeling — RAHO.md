Berikut seluruh **Architecture Modeling RAHO** dalam 4 diagram Mermaid beserta kode lengkapnya:

***
# 
## Diagram 1 — System Architecture (All Tiers)
Sistem RAHO dibangun dalam **5 tier** yang terpisah dengan koneksi yang jelas: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/b8c836b5-bacc-4921-ae1b-5d5a90a604ee/Usecase_ALL.md)

| Tier | Teknologi | Fungsi |
|---|---|---|
| **Client Layer** | Next.js 14 App Router | Staff Web App + Member Portal |
| **Gateway Layer** | Nginx | Reverse proxy, SSL termination, routing `/api/*` vs `/*` |
| **Application Layer** | Express.js | Route handlers, middleware chain, service layer |
| **Data Layer** | PostgreSQL + Prisma + MinIO | Persistence dan object storage |
| **Infrastructure** | Docker Compose | Container orchestration semua komponen |

***
## Diagram 2 — Request Lifecycle (Sequence)
Setiap request melewati **3 middleware berurutan** sebelum sampai ke service layer: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/753c4a7d-c0d1-4bba-a13f-107afb24aeeb/Usecase_AdminLayanan.md)

```
Request masuk
  →  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/b8c836b5-bacc-4921-ae1b-5d5a90a604ee/Usecase_ALL.md) JWT Verify      — validasi accessToken → 401 jika invalid
  →  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/753c4a7d-c0d1-4bba-a13f-107afb24aeeb/Usecase_AdminLayanan.md) authorize([])   — cek role diizinkan   → 403 jika bukan
  → [3] assertBranch    — cek akses ke member  → 403 jika bukan cabang
  → Route Handler → Service → Prisma Transaction → Response
```

Semua operasi yang melibatkan stok, voucher, atau data sensitif berjalan dalam satu **Prisma transaction** — jika satu query gagal, seluruh operasi di-rollback otomatis.

***
## Diagram 3 — Domain Model (6 Bounded Contexts)
Domain dibagi menjadi **6 bounded context** yang terisolasi: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/b8c836b5-bacc-4921-ae1b-5d5a90a604ee/Usecase_ALL.md)

| Domain | Inti Entitas |
|---|---|
| **Core** | `User`, `UserProfile`, `Branch`, `BranchMemberAccess` |
| **Member** | `Member`, `MemberDocument` |
| **Package** | `PackagePricing`, `MemberPackage` |
| **Therapy** | `Encounter` → `Session` → 8 entitas pendataan |
| **Inventory** | `MasterProduct` → `InventoryItem` → `StockMutation` |
| **Communication** | `Notification`, `ChatRoom`, `ChatMessage`, `AuditLog` |

***
## Diagram 4 — Docker Compose Deployment
```yaml
# Ringkasan docker-compose.yml
services:
  nginx:      # Port 443 (HTTPS) + 80 → redirect HTTPS
  fe-app:     # Next.js  — Port 3000 (internal)
  api-server: # Express  — Port 4000 (internal)
  postgres:   # PG 15    — Port 5432 (internal), volume: pgdata
  minio:      # MinIO    — Port 9000 API, 9001 Console, volume: miniodata
```

Nginx memisahkan traffic: request ke `/api/*` diteruskan ke `api-server:4000`, sementara semua route lain ke `fe-app:3000`. Database dan MinIO tidak pernah terekspos ke luar Docker network. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/753c4a7d-c0d1-4bba-a13f-107afb24aeeb/Usecase_AdminLayanan.md)

***
## Kode Mermaid Lengkap
Berikut kode semua diagram yang bisa langsung dipakai di dokumentasi:
### Diagram 1 — System Architecture
```mermaid
graph TB
    subgraph CLIENT["🖥️ CLIENT LAYER"]
        direction LR
        WEB_STAFF["Staff Web App · Next.js 14"]
        WEB_MEMBER["Member Portal · Next.js 14"]
    end

    subgraph GATEWAY["🔀 GATEWAY LAYER"]
        NGINX["Nginx · Reverse Proxy / SSL"]
    end

    subgraph APP["⚙️ APPLICATION LAYER — Express.js"]
        subgraph MIDDLEWARE["Middleware Chain"]
            MW1["JWT Verify"] --> MW2["authorize(roles[])"] --> MW3["assertBranchAccess"]
        end
        subgraph ROUTES["Routes"]
            RA["auth"] 
            RM["members"]
            RPK["packages"]
            RS["sessions"]
            RIN["inventory"]
        end
        subgraph SERVICES["Services"]
            SA["AuthService"]
            SM["MemberService"]
            SP["PackageService"]
            SS["SessionService"]
            SI["InventoryService"]
            SN["NotifService"]
            SAL["AuditLogService"]
        end
        MIDDLEWARE --> ROUTES --> SERVICES
    end

    subgraph DATA["🗄️ DATA LAYER"]
        PRISMA["Prisma ORM"] --> PG[("PostgreSQL 15")]
        MINIO[("MinIO Object Storage")]
    end

    WEB_STAFF -->|HTTPS| NGINX
    WEB_MEMBER -->|HTTPS| NGINX
    NGINX -->|/api/*| APP
    NGINX -->|/*| CLIENT
    SERVICES --> PRISMA
    SERVICES --> MINIO
```
### Diagram 2 — Request Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor Staff
    participant NX as Nginx
    participant MW as Middleware Chain
    participant SVC as Service Layer
    participant PRS as Prisma ORM
    participant PG as PostgreSQL
    participant MN as MinIO

    Staff->>NX: HTTPS Request
    NX->>MW: Forward /api/*
    MW->>MW: 1. Verify JWT accessToken
    alt Token invalid
        MW-->>Staff: 401 Unauthorized
    end
    MW->>MW: 2. authorize(roles[])
    alt Role not allowed
        MW-->>Staff: 403 Forbidden
    end
    MW->>MW: 3. assertBranchAccess
    alt Member not in branch
        MW-->>Staff: 403 No Access
    end
    MW->>SVC: passes all guards
    alt File upload
        SVC->>MN: upload to MinIO
        MN-->>SVC: return fileUrl
    end
    SVC->>PRS: prisma.transaction
    PRS->>PG: BEGIN + queries + COMMIT
    PG-->>SVC: result data
    SVC-->>Staff: 200/201 JSON
```
### Diagram 3 — Domain Model
```mermaid
graph TB
    subgraph CORE["👤 CORE"]
        USER["User · role · branchId"]
        BRANCH["Branch · branchCode"]
        BRANCH_ACCESS["BranchMemberAccess"]
    end
    subgraph MEMBER["🧑 MEMBER"]
        MEMBER_M["Member · memberNo · voucherCount"]
    end
    subgraph PACKAGE["📦 PACKAGE"]
        MEMBER_PKG["MemberPackage · status · branchId"]
    end
    subgraph THERAPY["💉 THERAPY"]
        ENCOUNTER["Encounter"]
        SESSION["TreatmentSession · pelaksanaan"]
        THERAPY_PLAN["TherapyPlan · 12 dosis"]
        DIAGNOSIS["Diagnosis · ICD"]
        VITAL["VitalSign · SEBELUM/SESUDAH"]
        INFUSION["InfusionExecution"]
        EMRNOTE["EMRNote · 4 tipe"]
        EVALUATION["DoctorEvaluation · SOAP"]
        ENCOUNTER --> SESSION
        SESSION --> THERAPY_PLAN
        SESSION --> EVALUATION
        SESSION --> VITAL
        SESSION --> INFUSION
        SESSION --> EMRNOTE
        ENCOUNTER --> DIAGNOSIS
    end
    subgraph INVENTORY["📦 INVENTORY"]
        MASTER_PROD["MasterProduct"]
        INV_ITEM["InventoryItem · stock"]
        STOCK_MUT["StockMutation · USED/RECEIVED"]
        MASTER_PROD --> INV_ITEM --> STOCK_MUT
    end

    MEMBER_M --> USER
    MEMBER_M <--> BRANCH_ACCESS
    MEMBER_PKG --> MEMBER_M
    MEMBER_PKG --> BRANCH
    ENCOUNTER --> MEMBER_M
    ENCOUNTER --> MEMBER_PKG
```
### Diagram 4 — Docker Deployment
```mermaid
graph TB
    subgraph INTERNET["🌐 Internet"]
        BROWSER["Browser (Staff / Member)"]
    end
    subgraph DOCKER["🐳 Docker Compose — raho-network"]
        NGINX["nginx:alpine · :443 HTTPS · SSL Termination"]
        FE["fe-app · Next.js 14 · :3000"]
        BE["api-server · Express.js · :4000"]
        PG[("postgres:15 · :5432 · Volume: pgdata")]
        MN[("minio · :9000 API · Volume: miniodata")]
    end

    BROWSER -->|HTTPS| NGINX
    NGINX -->|/* → :3000| FE
    NGINX -->|/api/* → :4000| BE
    FE --> BE
    BE -->|Prisma| PG
    BE -->|S3 SDK| MN
```