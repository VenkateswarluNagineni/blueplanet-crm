-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultPriceLevel" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "line1" TEXT,
ADD COLUMN     "line2" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Warehouse';
