-- CreateEnum
CREATE TYPE "EnforcementKind" AS ENUM ('WARNING', 'BADGE_REMOVED', 'SUSPENSION', 'BAN');

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "closedById" UUID,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "proposedById" UUID,
ADD COLUMN     "safetyShareCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "badgeRemovedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InspectionAvailability" (
    "listingId" UUID NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "weekly" JSONB NOT NULL DEFAULT '[]',
    "blockedDates" JSONB NOT NULL DEFAULT '[]',
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionAvailability_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "EnforcementAction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "EnforcementKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewTaskId" UUID,
    "staffId" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "idType" TEXT,
    "idNumberHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnforcementAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnforcementAction_userId_idx" ON "EnforcementAction"("userId");

-- CreateIndex
CREATE INDEX "EnforcementAction_idNumberHash_idx" ON "EnforcementAction"("idNumberHash");

-- AddForeignKey
ALTER TABLE "InspectionAvailability" ADD CONSTRAINT "InspectionAvailability_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One open booking per time slot of a listing, enforced by the database so two tenants cannot take the same slot.
CREATE UNIQUE INDEX "Inspection_open_slot_key" ON "Inspection" ("listingId", "scheduledAt") WHERE "status" IN ('REQUESTED', 'CONFIRMED');
