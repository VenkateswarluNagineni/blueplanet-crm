-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "assignedAssociateId" TEXT,
ADD COLUMN     "certifications" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "insurancePolicy" TEXT,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "materialCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "minOrderValue" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priceTier" TEXT,
ADD COLUMN     "rateBasis" TEXT,
ADD COLUMN     "remittanceInfo" TEXT,
ADD COLUMN     "resaleCertNumber" TEXT,
ADD COLUMN     "serviceArea" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "subType" TEXT,
ADD COLUMN     "taxExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "territory" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_partyId_idx" ON "Address"("partyId");

-- CreateIndex
CREATE INDEX "Contact_partyId_idx" ON "Contact"("partyId");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_assignedAssociateId_fkey" FOREIGN KEY ("assignedAssociateId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
