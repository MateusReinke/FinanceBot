-- AlterTable
ALTER TABLE "EventExpense" ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EventExpensePayment" (
    "id" TEXT NOT NULL,
    "eventExpenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EventExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventExpensePayment_eventExpenseId_userId_key" ON "EventExpensePayment"("eventExpenseId", "userId");

-- CreateIndex
CREATE INDEX "EventExpensePayment_userId_idx" ON "EventExpensePayment"("userId");

-- AddForeignKey
ALTER TABLE "EventExpensePayment" ADD CONSTRAINT "EventExpensePayment_eventExpenseId_fkey" FOREIGN KEY ("eventExpenseId") REFERENCES "EventExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventExpensePayment" ADD CONSTRAINT "EventExpensePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing expense had exactly one payer for its full
-- amount, which is precisely one payment row. Runs before the column is
-- dropped so no history is lost.
INSERT INTO "EventExpensePayment" ("id", "eventExpenseId", "userId", "amount")
SELECT gen_random_uuid()::text, "id", "paidById", "amount" FROM "EventExpense";

-- DropForeignKey / DropIndex / AlterTable
ALTER TABLE "EventExpense" DROP CONSTRAINT "EventExpense_paidById_fkey";
DROP INDEX "EventExpense_paidById_idx";
ALTER TABLE "EventExpense" DROP COLUMN "paidById";
