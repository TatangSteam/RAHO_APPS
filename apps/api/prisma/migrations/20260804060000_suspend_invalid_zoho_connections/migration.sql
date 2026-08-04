-- Irrecoverable OAuth grants must not remain active. Keeping the record retains
-- organization mappings and discovery history for the next authorized reconnect.
UPDATE "zoho_connections"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND COALESCE("lastError", '') ~* '(ZOHO_REFRESH_FAILED|invalid_code|invalid_grant|refresh token.*(expired|revoked|invalid))';
