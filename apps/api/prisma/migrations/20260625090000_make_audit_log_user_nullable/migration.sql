ALTER TABLE "public"."audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

ALTER TABLE "public"."audit_logs" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "public"."audit_logs"
ADD CONSTRAINT "audit_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
