-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "county" TEXT;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "accountingEmail" TEXT,
ADD COLUMN     "applyFinanceCharges" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collectionNotes" TEXT,
ADD COLUMN     "copyNotesToOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLockExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerSince" TIMESTAMP(3),
ADD COLUMN     "dba" TEXT,
ADD COLUMN     "defaultFulfillment" TEXT,
ADD COLUMN     "deliveryInstructions" TEXT,
ADD COLUMN     "docDeliveryPref" TEXT,
ADD COLUMN     "exemptCertExpiry" TIMESTAMP(3),
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "genericCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "holdDays" INTEGER,
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "multiLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentCustomerId" TEXT,
ADD COLUMN     "poRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "salesAlertNote" TEXT,
ADD COLUMN     "salesLockNote" TEXT,
ADD COLUMN     "salesTaxCode" TEXT,
ADD COLUMN     "secondaryPhone" TEXT,
ADD COLUMN     "taxExemptReason" TEXT;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_parentCustomerId_fkey" FOREIGN KEY ("parentCustomerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
