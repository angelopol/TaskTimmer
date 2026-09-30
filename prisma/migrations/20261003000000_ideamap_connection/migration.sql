-- CreateTable
CREATE TABLE "IdeaMapConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "ideamapUserName" TEXT,
    "ideamapEmail" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdeaMapConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdeaMapConnection_userId_key" ON "IdeaMapConnection"("userId");

-- AddForeignKey
ALTER TABLE "IdeaMapConnection" ADD CONSTRAINT "IdeaMapConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
