-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "contentType" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IdentityVerification" ADD COLUMN     "documentId" UUID;

-- CreateIndex
CREATE INDEX "Document_deleteAfter_idx" ON "Document"("deleteAfter");

-- CreateIndex
CREATE UNIQUE INDEX "Document_ownerId_idempotencyKey_key" ON "Document"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerification_documentId_key" ON "IdentityVerification"("documentId");

-- AddForeignKey
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

