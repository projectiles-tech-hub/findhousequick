-- CreateEnum
CREATE TYPE "IdentityNextAction" AS ENUM ('UPLOAD_ID_DOCUMENT');

-- AlterEnum
ALTER TYPE "ReviewTaskType" ADD VALUE 'AGENT_PROFILE_REVIEW';

-- AlterTable
ALTER TABLE "AgentProfile" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "CheckStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "IdentityVerification" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "nextAction" "IdentityNextAction";

-- CreateIndex
CREATE INDEX "IdentityVerification_userId_createdAt_idx" ON "IdentityVerification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerification_provider_providerReference_key" ON "IdentityVerification"("provider", "providerReference");

