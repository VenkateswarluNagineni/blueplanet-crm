-- AlterTable
ALTER TABLE "CompanySetting" ADD COLUMN     "reconciliationInboxToken" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "reconciliationDeltaId" TEXT;

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "providerMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "rawPayload" JSONB NOT NULL,
    "attachments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCase" (
    "id" TEXT NOT NULL,
    "inboundMessageId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "matchMethod" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "threadKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_MATCH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDelta" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "sourceExcerpt" TEXT,
    "confidence" DOUBLE PRECISION,
    "retroactive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "affectedInventoryItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationDelta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_providerMessageId_key" ON "InboundMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "InboundMessage_status_idx" ON "InboundMessage"("status");

-- CreateIndex
CREATE INDEX "ReconciliationCase_status_idx" ON "ReconciliationCase"("status");

-- CreateIndex
CREATE INDEX "ReconciliationCase_purchaseOrderId_idx" ON "ReconciliationCase"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "ReconciliationDelta_caseId_idx" ON "ReconciliationDelta"("caseId");

-- CreateIndex
CREATE INDEX "ReconciliationDelta_purchaseOrderId_status_idx" ON "ReconciliationDelta"("purchaseOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_reconciliationInboxToken_key" ON "CompanySetting"("reconciliationInboxToken");

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_inboundMessageId_fkey" FOREIGN KEY ("inboundMessageId") REFERENCES "InboundMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDelta" ADD CONSTRAINT "ReconciliationDelta_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReconciliationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDelta" ADD CONSTRAINT "ReconciliationDelta_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

