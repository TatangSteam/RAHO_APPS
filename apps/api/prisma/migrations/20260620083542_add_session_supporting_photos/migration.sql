-- CreateTable
CREATE TABLE "session_supporting_photos" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_supporting_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_supporting_photos_treatmentSessionId_idx" ON "session_supporting_photos"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "session_supporting_photos_createdAt_idx" ON "session_supporting_photos"("createdAt");

-- AddForeignKey
ALTER TABLE "session_supporting_photos" ADD CONSTRAINT "session_supporting_photos_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
