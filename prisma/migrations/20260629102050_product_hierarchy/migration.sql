-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "altName" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "genericSku" TEXT,
ADD COLUMN     "productGroup" TEXT,
ADD COLUMN     "productType" TEXT NOT NULL DEFAULT 'SLAB',
ADD COLUMN     "subCategory" TEXT;
