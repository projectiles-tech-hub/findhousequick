-- CreateTable
CREATE TABLE "MapsAnswer" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapsAnswer_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MapsAnswer_expiresAt_idx" ON "MapsAnswer"("expiresAt");

