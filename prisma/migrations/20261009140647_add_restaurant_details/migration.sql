-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "detailsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "googleRatingCount" INTEGER,
ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "priceLevel" INTEGER,
ADD COLUMN     "utcOffsetMinutes" INTEGER,
ADD COLUMN     "website" TEXT;
