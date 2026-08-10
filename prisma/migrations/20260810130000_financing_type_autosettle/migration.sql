-- AlterTable
ALTER TABLE "Financing" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'expense',
ADD COLUMN     "autoSettle" BOOLEAN NOT NULL DEFAULT true;
