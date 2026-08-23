-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "invoiceForAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_invoiceForAccountId_idx" ON "Transaction"("invoiceForAccountId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceForAccountId_fkey" FOREIGN KEY ("invoiceForAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
