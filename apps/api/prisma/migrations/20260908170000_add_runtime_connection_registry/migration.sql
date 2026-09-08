CREATE TABLE "runtime_database_profiles" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "runtime_database_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runtime_zoho_api_profiles" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedClientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "accountsBaseUrl" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "runtime_zoho_api_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runtime_zoho_organization_bindings" (
    "id" TEXT NOT NULL,
    "databaseProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "zohoApiProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "runtime_zoho_organization_bindings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "runtime_database_profiles_isEnabled_label_idx"
ON "runtime_database_profiles"("isEnabled", "label");

CREATE INDEX "runtime_zoho_api_profiles_isActive_label_idx"
ON "runtime_zoho_api_profiles"("isActive", "label");

CREATE UNIQUE INDEX "runtime_zoho_organization_bindings_databaseProfileId_organizationId_key"
ON "runtime_zoho_organization_bindings"("databaseProfileId", "organizationId");

CREATE INDEX "runtime_zoho_organization_bindings_zohoApiProfileId_idx"
ON "runtime_zoho_organization_bindings"("zohoApiProfileId");

ALTER TABLE "runtime_zoho_organization_bindings"
ADD CONSTRAINT "runtime_zoho_organization_bindings_zohoApiProfileId_fkey"
FOREIGN KEY ("zohoApiProfileId") REFERENCES "runtime_zoho_api_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
