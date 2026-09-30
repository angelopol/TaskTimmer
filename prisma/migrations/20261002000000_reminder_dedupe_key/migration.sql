-- Reminders are a re-syncable copy; clear them so the new required key can be added. The next sync restores them.
DELETE FROM "ExternalReminder";

-- AlterTable
ALTER TABLE "ExternalReminder" ADD COLUMN "externalKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "IntegrationToken" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReminder_userId_externalKey_key" ON "ExternalReminder"("userId", "externalKey");
