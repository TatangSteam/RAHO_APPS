CREATE TYPE "WhatsAppConnectionStatus" AS ENUM (
  'DISCONNECTED',
  'PAIRING',
  'CONNECTING',
  'CONNECTED',
  'RECONNECTING',
  'LOGGED_OUT',
  'ERROR'
);

CREATE TABLE "whatsapp_connections" (
  "id" TEXT NOT NULL,
  "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "phoneMasked" TEXT,
  "authStateEncrypted" TEXT,
  "authKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "lastConnectedAt" TIMESTAMP(3),
  "lastDisconnectedAt" TIMESTAMP(3),
  "lastErrorSanitized" TEXT,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);
