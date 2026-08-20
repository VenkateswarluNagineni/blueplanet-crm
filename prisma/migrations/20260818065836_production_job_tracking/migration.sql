-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "blockerNote" TEXT,
ADD COLUMN     "fabricatedAt" TIMESTAMP(3),
ADD COLUMN     "installSignatureDataUri" TEXT,
ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "installerId" TEXT,
ADD COLUMN     "productionStage" TEXT NOT NULL DEFAULT 'QUOTED',
ADD COLUMN     "templatedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
