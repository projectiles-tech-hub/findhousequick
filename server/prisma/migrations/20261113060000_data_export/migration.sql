-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PREPARING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DataExport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PREPARING',
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataExport_userId_requestedAt_idx" ON "DataExport"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

