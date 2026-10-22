-- Staff two-step login (ADR 0005) and withdrawal requests for feature rules (ADR 0002 as confirmed).
-- twoFactorEnabled is replaced by the authenticator fields; it was never set by any code.
-- AlterTable
ALTER TABLE "FeatureRule" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archiveRequestedAt" TIMESTAMP(3),
ADD COLUMN     "archiveRequestedById" UUID;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "twoStepAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StaffMember" DROP COLUMN "twoFactorEnabled",
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpPendingSecretEncrypted" TEXT,
ADD COLUMN     "totpSecretEncrypted" TEXT,
ADD COLUMN     "twoStepFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoStepLockedUntil" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

