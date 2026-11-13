-- CreateTable
CREATE TABLE "UserBlock" (
    "id" UUID NOT NULL,
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "conversationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMP(3),

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_unblockedAt_idx" ON "UserBlock"("blockerId", "unblockedAt");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_unblockedAt_idx" ON "UserBlock"("blockedId", "unblockedAt");

