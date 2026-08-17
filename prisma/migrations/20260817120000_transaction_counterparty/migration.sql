-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "counterparty" TEXT,
ADD COLUMN     "counterpartyPhone" TEXT,
ADD COLUMN     "chargedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Transaction_userId_balanceApplied_date_idx" ON "Transaction"("userId", "balanceApplied", "date");
