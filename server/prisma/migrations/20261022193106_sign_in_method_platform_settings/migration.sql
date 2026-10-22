-- Decision 34 (ADR 0005): record how each signed-in device signed in.
-- Decision 32 (ADR 0005): platform-wide settings, starting with how long the staff second step lasts.

-- CreateEnum
CREATE TYPE "SignInMethod" AS ENUM ('PASSWORD', 'SMS_CODE');

-- AlterTable
-- Devices signed in before this change have no record of how they signed in. They are treated as having used an
-- SMS code, the stricter case, so none of them can pass the staff second step with a second SMS code.
ALTER TABLE "RefreshToken" ADD COLUMN "signInMethod" "SignInMethod" NOT NULL DEFAULT 'SMS_CODE';
ALTER TABLE "RefreshToken" ALTER COLUMN "signInMethod" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id"),
    -- There is only ever one row of platform settings.
    CONSTRAINT "PlatformSettings_single_row" CHECK ("id" = 1)
);
