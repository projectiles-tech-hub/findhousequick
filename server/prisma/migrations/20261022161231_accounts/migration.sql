-- Accounts (Release 1 step 1): consent record, password lockout, single-use refresh token families.
-- RefreshToken.familyId has no default: no refresh tokens existed before this step.
-- DropIndex
DROP INDEX "OtpCode_phone_purpose_idx";

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" UUID NOT NULL,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "failedPasswordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordLockedUntil" TIMESTAMP(3),
ADD COLUMN     "privacyVersion" TEXT,
ADD COLUMN     "termsVersion" TEXT;

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
