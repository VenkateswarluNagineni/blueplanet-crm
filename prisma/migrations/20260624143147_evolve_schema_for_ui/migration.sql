-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_customerId_fkey";

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "baseLocation" TEXT,
ADD COLUMN     "commissionRate" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "incoterms" TEXT,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "serviceType" TEXT,
ADD COLUMN     "systemId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "approvedSupplierIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "avgCostPerSf" DOUBLE PRECISION,
ADD COLUMN     "minPricePerSf" DOUBLE PRECISION,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "retailPricePerSf" DOUBLE PRECISION,
ADD COLUMN     "thickness" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "customsVendorId" TEXT,
ADD COLUMN     "destinationHub" TEXT,
ADD COLUMN     "documentRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eta" TEXT,
ADD COLUMN     "inlandVendorId" TEXT,
ADD COLUMN     "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ledgerHash" TEXT,
ADD COLUMN     "logisticsStatus" TEXT NOT NULL DEFAULT 'PRODUCTION',
ADD COLUMN     "oceanVendorId" TEXT,
ADD COLUMN     "orderedSlabs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "status" SET DEFAULT 'ISSUED';

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "associateId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "receiptRef" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PLACED';

-- CreateTable
CREATE TABLE "VendorInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNum" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "dueDate" TIMESTAMP(3),
    "serviceDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesCanViewLandedCost" BOOLEAN NOT NULL DEFAULT false,
    "salesCanViewAllPipeline" BOOLEAN NOT NULL DEFAULT false,
    "vendorCanViewFullInventory" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvoice_invoiceNum_key" ON "VendorInvoice"("invoiceNum");

-- CreateIndex
CREATE INDEX "VendorInvoice_vendorId_idx" ON "VendorInvoice"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_companyId_key" ON "CompanySetting"("companyId");

-- CreateIndex
CREATE INDEX "EventOutbox_status_idx" ON "EventOutbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Party_systemId_key" ON "Party"("systemId");

-- CreateIndex
CREATE INDEX "Party_type_idx" ON "Party"("type");

-- CreateIndex
CREATE INDEX "PurchaseOrder_logisticsStatus_idx" ON "PurchaseOrder"("logisticsStatus");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
