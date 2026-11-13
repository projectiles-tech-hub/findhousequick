-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "occupied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnitPart" ADD COLUMN     "outside" BOOLEAN NOT NULL DEFAULT false;


-- Frontage and compound are outside the unit (Specification 5.3).
UPDATE "UnitPart" SET "outside" = true WHERE "code" IN ('frontage', 'compound');
