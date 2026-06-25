-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "leadName" TEXT,
    "leadEmail" TEXT,
    "leadPhone" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "associateId" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
