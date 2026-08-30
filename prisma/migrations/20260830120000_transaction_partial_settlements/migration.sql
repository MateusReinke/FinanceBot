-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "partialOfId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_partialOfId_idx" ON "Transaction"("partialOfId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_partialOfId_fkey" FOREIGN KEY ("partialOfId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
