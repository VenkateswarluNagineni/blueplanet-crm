-- CreateTable
CREATE TABLE "SlabPhoto" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT,
    "uploadedByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlabPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlabPhoto_inventoryItemId_idx" ON "SlabPhoto"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "SlabPhoto" ADD CONSTRAINT "SlabPhoto_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
