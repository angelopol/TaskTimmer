-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    CONSTRAINT "ScheduleSegment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSegment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleSegment" ("activityId", "createdAt", "endMinute", "id", "notes", "startMinute", "updatedAt", "userId", "weekday") SELECT "activityId", "createdAt", "endMinute", "id", "notes", "startMinute", "updatedAt", "userId", "weekday" FROM "ScheduleSegment";
DROP TABLE "ScheduleSegment";
ALTER TABLE "new_ScheduleSegment" RENAME TO "ScheduleSegment";
CREATE INDEX "ScheduleSegment_userId_weekday_idx" ON "ScheduleSegment"("userId", "weekday");
CREATE INDEX "ScheduleSegment_userId_effectiveFrom_effectiveTo_idx" ON "ScheduleSegment"("userId", "effectiveFrom", "effectiveTo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
