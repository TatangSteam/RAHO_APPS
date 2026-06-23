# Implementasi Notifikasi WhatsApp dengan Baileys

## 1. Overview

Sistem notifikasi WhatsApp menggunakan library `@whiskeysockets/baileys` untuk mengirim pesan otomatis ke member melalui nomor WhatsApp perusahaan yang dikonfigurasi oleh Super Admin.

### Fitur Utama:
- ✅ Koneksi WhatsApp menggunakan Baileys (WhatsApp Web API)
- ✅ Konfigurasi nomor WA perusahaan oleh Super Admin
- ✅ Template pesan yang dapat dikustomisasi
- ✅ Trigger otomatis untuk berbagai event (assign paket, verifikasi pembayaran, dll)
- ✅ Queue system untuk pengiriman pesan
- ✅ Logging dan monitoring status pesan

---

## 2. Arsitektur

```
[Frontend] → [API Backend] → [WhatsApp Service] → [Baileys] → [WhatsApp]
                                      ↓
                              [Message Queue]
                                      ↓
                            [Database (Prisma)]
```

---

## 3. Database Schema Changes

### 3.1. Tabel `WhatsAppConfig`
```prisma
model WhatsAppConfig {
  id            String   @id @default(cuid())
  phoneNumber   String   @unique // Format: 628123456789
  displayName   String
  isActive      Boolean  @default(false)
  isConnected   Boolean  @default(false)
  sessionData   Json?    // Baileys session data
  qrCode        String?  // QR code untuk pairing
  lastConnected DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("whatsapp_config")
}
```

### 3.2. Tabel `WhatsAppMessage`
```prisma
model WhatsAppMessage {
  id          String   @id @default(cuid())
  memberId    String
  member      Member   @relation(fields: [memberId], references: [id])
  to          String   // Nomor penerima
  message     String   @db.Text
  status      WhatsAppMessageStatus @default(PENDING)
  sentAt      DateTime?
  deliveredAt DateTime?
  readAt      DateTime?
  errorMessage String?
  metadata    Json?    // Data tambahan (packageId, sessionId, dll)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("whatsapp_messages")
}

enum WhatsAppMessageStatus {
  PENDING
  SENDING
  SENT
  DELIVERED
  READ
  FAILED
}
```

---

## 4. Backend Implementation

### 4.1. Install Dependencies
```bash
cd apps/api
npm install @whiskeysockets/baileys pino qrcode-terminal
```

### 4.2. Service Structure
```
apps/api/src/modules/whatsapp/
├── whatsapp.module.ts
├── whatsapp.controller.ts
├── whatsapp.routes.ts
├── whatsapp.schema.ts
├── services/
│   ├── whatsapp-connection.service.ts
│   ├── whatsapp-message.service.ts
│   └── whatsapp-template.service.ts
└── __tests__/
    └── whatsapp.service.test.ts
```

### 4.3. Environment Variables
```env
# .env
WHATSAPP_ENABLED=true
WHATSAPP_SESSION_PATH=./whatsapp-sessions
WHATSAPP_WEBHOOK_URL=https://your-domain.com/api/v1/whatsapp/webhook
```

---

## 5. Frontend Implementation

### 5.1. Admin Settings Page
```
apps/web/src/app/(staff)/admin/whatsapp/page.tsx
```

Fitur:
- Scan QR Code untuk pairing WA
- Status koneksi WA
- Konfigurasi template pesan
- Test kirim pesan
- View message history

### 5.2. Notification Triggers
Notifikasi otomatis akan dikirim pada event:
1. **Member baru registrasi** - Ucapan selamat datang
2. **Paket di-assign** - Info paket yang dibeli
3. **Pembayaran verified** - Konfirmasi pembayaran  
4. **Session dijadwalkan** - Reminder sesi terapi
5. **Session selesai** - Follow-up dan feedback

---

## 6. Message Templates

```typescript
export const MESSAGE_TEMPLATES = {
  WELCOME: (memberName: string) => 
    `Halo ${memberName}! 👋\n\nSelamat bergabung di RAHO. Terima kasih telah mempercayakan kesehatan Anda kepada kami.`,
  
  PACKAGE_ASSIGNED: (memberName: string, packageName: string, price: number) =>
    `Halo ${memberName},\n\nPaket Anda:\n📦 ${packageName}\n💰 Rp ${price.toLocaleString('id-ID')}\n\nSegera lakukan pembayaran.`,
  
  PAYMENT_VERIFIED: (memberName: string, amount: number) =>
    `Halo ${memberName},\n\n✅ Pembayaran Rp ${amount.toLocaleString('id-ID')} telah dikonfirmasi.\n\nTerima kasih!`,
};
```

---

## 7. Security & Best Practices

### 7.1. Security
- ❌ JANGAN simpan credentials di code
- ✅ Gunakan environment variables
- ✅ Encrypt session data di database
- ✅ Rate limiting untuk prevent spam
- ✅ Validasi nomor telepon sebelum kirim

### 7.2. Reliability
- ✅ Implement message queue (Bull/BullMQ)
- ✅ Retry mechanism untuk failed messages
- ✅ Logging semua aktivitas
- ✅ Health check endpoint untuk monitoring

---

## 8. Implementation Steps

### Step 1: Database Migration
```bash
cd apps/api
npx prisma migrate dev --name add_whatsapp_tables
```

### Step 2: Create WhatsApp Module
- Create service files
- Implement Baileys integration
- Setup message queue

### Step 3: Create API Endpoints
- POST /api/v1/whatsapp/connect - Initiate connection
- GET /api/v1/whatsapp/qr - Get QR code
- POST /api/v1/whatsapp/send - Send message
- GET /api/v1/whatsapp/status - Check connection status

### Step 4: Frontend Integration
- Create admin settings page
- Add notification triggers
- Implement message history viewer

### Step 5: Testing
- Unit tests for services
- Integration tests for API
- E2E tests for full flow

---

## 9. Docker Setup (RECOMMENDED)

### 9.1. Mengapa Docker?

**SANGAT DISARANKAN** menggunakan Docker untuk WhatsApp service karena:

✅ **Persistent Sessions** - Session Baileys tersimpan aman di volume
✅ **Auto-Restart** - Service auto restart jika crash
✅ **Isolated Environment** - Tidak ganggu aplikasi utama
✅ **Easy Scaling** - Mudah deploy ke production
✅ **Resource Control** - Batasi CPU/memory usage

### 9.2. Dockerfile untuk WhatsApp Service

```dockerfile
# apps/whatsapp-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create session directory
RUN mkdir -p /app/sessions

# Expose port for health check
EXPOSE 3001

# Run the service
CMD ["node", "dist/index.js"]
```

### 9.3. docker-compose.yml

```yaml
version: '3.8'

services:
  # Main API (existing)
  api:
    build:
      context: ./apps/api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - WHATSAPP_SERVICE_URL=http://whatsapp-service:3001
    depends_on:
      - postgres
      - whatsapp-service

  # WhatsApp Service (new)
  whatsapp-service:
    build:
      context: ./apps/whatsapp-service
    ports:
      - "3001:3001"
    volumes:
      # Persistent storage untuk session Baileys
      - whatsapp-sessions:/app/sessions
      - whatsapp-media:/app/media
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - API_URL=http://api:3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Database (existing)
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}

volumes:
  postgres-data:
  whatsapp-sessions:
  whatsapp-media:
```

### 9.4. WhatsApp Service Structure

```
apps/whatsapp-service/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── baileys-client.ts     # Baileys connection
│   ├── message-handler.ts    # Message processing
│   ├── api-client.ts         # Communicate with main API
│   └── health-check.ts       # Health endpoint
└── sessions/                 # Baileys session storage
```

### 9.5. Main API Integration

```typescript
// apps/api/src/modules/whatsapp/services/whatsapp-client.service.ts
export class WhatsAppClientService {
  private serviceUrl = process.env.WHATSAPP_SERVICE_URL;

  async sendMessage(to: string, message: string): Promise<void> {
    await axios.post(`${this.serviceUrl}/send`, {
      to,
      message
    });
  }

  async getStatus(): Promise<ConnectionStatus> {
    const response = await axios.get(`${this.serviceUrl}/status`);
    return response.data;
  }

  async getQRCode(): Promise<string> {
    const response = await axios.get(`${this.serviceUrl}/qr`);
    return response.data.qrCode;
  }
}
```

### 9.6. Deployment Commands

```bash
# Development
docker-compose up -d

# Production build
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f whatsapp-service

# Restart service
docker-compose restart whatsapp-service

# Stop all
docker-compose down
```

### 9.7. Monitoring & Maintenance

```bash
# Check health
curl http://localhost:3001/health

# View connection status
curl http://localhost:3001/status

# Backup session data
docker run --rm -v whatsapp-sessions:/data -v $(pwd):/backup alpine tar czf /backup/sessions-backup.tar.gz /data

# Restore session data
docker run --rm -v whatsapp-sessions:/data -v $(pwd):/backup alpine tar xzf /backup/sessions-backup.tar.gz -C /
```

---

## 10. Deployment Considerations

### 10.1. Server Requirements
- **RAM**: Minimum 2GB untuk WhatsApp service
- **Storage**: Minimum 10GB untuk sessions & media
- **CPU**: 1-2 cores cukup
- **Network**: Stable internet connection

### 10.2. Monitoring
- Setup alerts untuk connection drops
- Monitor message delivery rates
- Track failed messages
- Monitor docker container health

### 10.3. Backup Strategy
- Daily backup session data
- Backup QR code pairing info
- Backup message logs
- Store backups di cloud storage

---

## 10. Limitations & Alternatives

### Baileys Limitations:
- WhatsApp dapat ban akun jika terdeteksi spam
- Perlu re-authenticate jika session expired
- Tidak support WhatsApp Business API official

### Alternative Solutions:
- **Fonnte API** - Paid service, lebih stable
- **WA Business API** - Official, mahal tapi reliable
- **Twilio WhatsApp** - Enterprise solution

---

## 11. Cost Estimation

### Using Baileys (Free):
- Server cost: Rp 100-300k/bulan
- Development time: ~40-60 jam
- Risk: Medium (possible ban)

### Using Paid Service (Fonnte):
- Service cost: Rp 100-200/pesan
- Development time: ~10-15 jam  
- Risk: Low (official partner)

---

## Kesimpulan

Implementasi WhatsApp notification dengan Baileys **bisa dilakukan** tapi memerlukan:
1. Persiapan infrastruktur yang baik
2. Monitoring yang ketat
3. Backup plan jika terjadi ban
4. Development time yang significant

**Rekomendasi**: Untuk production, pertimbangkan menggunakan paid service seperti Fonnte atau WhatsApp Business API official untuk reliability yang lebih baik.
