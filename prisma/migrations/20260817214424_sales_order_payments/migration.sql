-- CreateTable
CREATE TABLE "SOPayment" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "recordedByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SOPayment_salesOrderId_idx" ON "SOPayment"("salesOrderId");

-- AddForeignKey
ALTER TABLE "SOPayment" ADD CONSTRAINT "SOPayment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

