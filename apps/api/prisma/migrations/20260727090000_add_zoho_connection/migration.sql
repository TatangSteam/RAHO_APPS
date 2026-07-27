CREATE TABLE "zoho_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "dataCenter" TEXT NOT NULL,
    "apiDomain" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "zoho_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_connections_organizationId_key" ON "zoho_connections"("organizationId");
CREATE INDEX "zoho_connections_isActive_idx" ON "zoho_connections"("isActive");
ALTER TABLE "zoho_connections" ADD CONSTRAINT "zoho_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "zoho_connections" ADD CONSTRAINT "zoho_connections_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
