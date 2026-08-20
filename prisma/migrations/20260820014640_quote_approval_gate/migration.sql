-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByPartyId" TEXT;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_approvedByPartyId_fkey" FOREIGN KEY ("approvedByPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
