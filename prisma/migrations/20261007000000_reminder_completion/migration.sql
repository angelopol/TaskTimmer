-- AlterTable
ALTER TABLE "ExternalReminder" ADD COLUMN "completionRequestedAt" TIMESTAMP(3),
ADD COLUMN "completionSentAt" TIMESTAMP(3);
