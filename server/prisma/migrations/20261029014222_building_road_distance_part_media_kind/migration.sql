-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "distanceToMainRoadM" INTEGER;

-- AlterTable
ALTER TABLE "UnitPart" ADD COLUMN     "mediaKind" "MediaKind" NOT NULL DEFAULT 'PHOTO';
