-- CreateEnum
CREATE TYPE "ScoutStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ScoutInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ScoutRewardStatus" AS ENUM ('WAITING_FOR_RENTAL', 'ELIGIBLE', 'APPROVED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "ScoutVoidReason" AS ENUM ('RENTED_THROUGH_ESCROW', 'CONFLICT_OF_INTEREST', 'VOIDED_BY_STAFF');

-- AlterEnum
ALTER TYPE "ReviewTaskType" ADD VALUE 'SCOUT_CONFLICT';

-- CreateTable
CREATE TABLE "UserDevice" (
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("userId","deviceId")
);

-- CreateTable
CREATE TABLE "ScoutProfile" (
    "userId" UUID NOT NULL,
    "status" "ScoutStatus" NOT NULL DEFAULT 'ACTIVE',
    "optedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "suspendedById" UUID,

    CONSTRAINT "ScoutProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ScoutReport" (
    "id" UUID NOT NULL,
    "scoutId" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "description" TEXT NOT NULL,
    "landlordName" TEXT,
    "alreadyOnPlatform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutInvitation" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "scoutId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "ScoutInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedById" UUID,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutReferral" (
    "id" UUID NOT NULL,
    "scoutId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutRewardLine" (
    "id" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "status" "ScoutRewardStatus" NOT NULL DEFAULT 'WAITING_FOR_RENTAL',
    "voidReason" "ScoutVoidReason",
    "voidNote" TEXT,
    "amountMinor" BIGINT,
    "currency" CHAR(3),
    "rentedAt" TIMESTAMP(3),
    "eligibleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoutRewardLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDevice_deviceId_idx" ON "UserDevice"("deviceId");

-- CreateIndex
CREATE INDEX "ScoutReport_scoutId_idx" ON "ScoutReport"("scoutId");

-- CreateIndex
CREATE INDEX "ScoutReport_location_idx" ON "ScoutReport" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutInvitation_reportId_key" ON "ScoutInvitation"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutInvitation_codeHash_key" ON "ScoutInvitation"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutInvitation_acceptedById_key" ON "ScoutInvitation"("acceptedById");

-- CreateIndex
CREATE INDEX "ScoutInvitation_scoutId_idx" ON "ScoutInvitation"("scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutReferral_invitationId_key" ON "ScoutReferral"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutReferral_buildingId_key" ON "ScoutReferral"("buildingId");

-- CreateIndex
CREATE INDEX "ScoutReferral_scoutId_idx" ON "ScoutReferral"("scoutId");

-- CreateIndex
CREATE INDEX "ScoutReferral_landlordId_idx" ON "ScoutReferral"("landlordId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutRewardLine_unitId_key" ON "ScoutRewardLine"("unitId");

-- CreateIndex
CREATE INDEX "ScoutRewardLine_referralId_idx" ON "ScoutRewardLine"("referralId");

-- CreateIndex
CREATE INDEX "ScoutRewardLine_status_idx" ON "ScoutRewardLine"("status");

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutProfile" ADD CONSTRAINT "ScoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutReport" ADD CONSTRAINT "ScoutReport_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "ScoutProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutInvitation" ADD CONSTRAINT "ScoutInvitation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ScoutReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutReferral" ADD CONSTRAINT "ScoutReferral_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ScoutInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutRewardLine" ADD CONSTRAINT "ScoutRewardLine_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "ScoutReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

