-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "salesTargetAnnual" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardLayout" JSONB,
ADD COLUMN     "partyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_partyId_key" ON "User"("partyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
