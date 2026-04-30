-- CreateTable
CREATE TABLE "session_doctors" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_nurses" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_nurses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_doctors_sessionId_idx" ON "session_doctors"("sessionId");

-- CreateIndex
CREATE INDEX "session_doctors_doctorId_idx" ON "session_doctors"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "session_doctors_sessionId_doctorId_key" ON "session_doctors"("sessionId", "doctorId");

-- CreateIndex
CREATE INDEX "session_nurses_sessionId_idx" ON "session_nurses"("sessionId");

-- CreateIndex
CREATE INDEX "session_nurses_nurseId_idx" ON "session_nurses"("nurseId");

-- CreateIndex
CREATE UNIQUE INDEX "session_nurses_sessionId_nurseId_key" ON "session_nurses"("sessionId", "nurseId");

-- AddForeignKey
ALTER TABLE "session_doctors" ADD CONSTRAINT "session_doctors_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_doctors" ADD CONSTRAINT "session_doctors_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_nurses" ADD CONSTRAINT "session_nurses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_nurses" ADD CONSTRAINT "session_nurses_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
