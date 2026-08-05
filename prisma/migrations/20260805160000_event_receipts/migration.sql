-- AlterTable
ALTER TABLE "EventExpense" ADD COLUMN     "receiptId" TEXT;

-- CreateTable
CREATE TABLE "EventReceipt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReceipt_eventId_idx" ON "EventReceipt"("eventId");

-- CreateIndex
CREATE INDEX "EventReceipt_uploadedById_idx" ON "EventReceipt"("uploadedById");

-- CreateIndex
CREATE INDEX "EventExpense_receiptId_idx" ON "EventExpense"("receiptId");

-- AddForeignKey
ALTER TABLE "EventExpense" ADD CONSTRAINT "EventExpense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "EventReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReceipt" ADD CONSTRAINT "EventReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReceipt" ADD CONSTRAINT "EventReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

