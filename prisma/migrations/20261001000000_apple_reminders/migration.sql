-- CreateTable
CREATE TABLE "IntegrationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'apple-reminders',
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'apple',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "list" TEXT,
    "dueAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_tokenHash_key" ON "IntegrationToken"("tokenHash");
CREATE UNIQUE INDEX "IntegrationToken_userId_kind_key" ON "IntegrationToken"("userId", "kind");
CREATE INDEX "ExternalReminder_userId_dueAt_idx" ON "ExternalReminder"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalReminder" ADD CONSTRAINT "ExternalReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
