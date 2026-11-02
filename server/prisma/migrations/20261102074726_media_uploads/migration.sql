
-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "occupantConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "partSizeBytes" INTEGER,
ADD COLUMN     "sizeBytes" INTEGER;

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_uploadedById_idempotencyKey_key" ON "MediaAsset"("uploadedById", "idempotencyKey");
