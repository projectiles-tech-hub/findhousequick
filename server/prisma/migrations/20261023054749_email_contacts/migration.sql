-- Email and contacts (decisions 35 to 38, ADR 0006).

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');

-- AlterEnum: devices can sign in with a code sent by email.
ALTER TYPE "SignInMethod" ADD VALUE 'EMAIL_CODE';

-- One-time codes can go by SMS or email. Existing codes were all sent by SMS to the number now in "destination".
DROP INDEX "OtpCode_phone_purpose_createdAt_idx";
ALTER TABLE "OtpCode" RENAME COLUMN "phone" TO "destination";
ALTER TABLE "OtpCode" ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'SMS';
ALTER TABLE "OtpCode" ALTER COLUMN "channel" DROP DEFAULT;
CREATE INDEX "OtpCode_destination_purpose_createdAt_idx" ON "OtpCode"("destination", "purpose", "createdAt");

-- A phone number can be released to another account that confirms it (ADR 0006), leaving this one empty.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
