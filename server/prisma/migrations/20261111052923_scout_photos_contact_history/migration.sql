-- CreateTable
CREATE TABLE "ConfirmedContact" (
    "userId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "firstConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmedContact_pkey" PRIMARY KEY ("userId","channel","valueHash")
);

-- CreateTable
CREATE TABLE "ScoutReportPhoto" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfirmedContact_valueHash_idx" ON "ConfirmedContact"("valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutReportPhoto_storageKey_key" ON "ScoutReportPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "ScoutReportPhoto_reportId_idx" ON "ScoutReportPhoto"("reportId");

-- AddForeignKey
ALTER TABLE "ConfirmedContact" ADD CONSTRAINT "ConfirmedContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutReportPhoto" ADD CONSTRAINT "ScoutReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ScoutReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

