CREATE TABLE "SalesAgentEmailDelivery" (
  "salesAgentEmailDeliveryId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "messageId" TEXT,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesAgentEmailDelivery_pkey" PRIMARY KEY ("salesAgentEmailDeliveryId")
);

CREATE UNIQUE INDEX "SalesAgentEmailDelivery_notificationId_key"
  ON "SalesAgentEmailDelivery"("notificationId");
CREATE INDEX "SalesAgentEmailDelivery_status_nextAttemptAt_idx"
  ON "SalesAgentEmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");
ALTER TABLE "SalesAgentEmailDelivery"
  ADD CONSTRAINT "SalesAgentEmailDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
