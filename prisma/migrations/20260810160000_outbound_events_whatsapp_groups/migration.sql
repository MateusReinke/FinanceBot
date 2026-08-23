-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "whatsappGroupId" TEXT,
ADD COLUMN     "whatsappGroupStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "OutboundEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundEvent_status_nextAttemptAt_idx" ON "OutboundEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboundEvent_eventId_idx" ON "OutboundEvent"("eventId");
