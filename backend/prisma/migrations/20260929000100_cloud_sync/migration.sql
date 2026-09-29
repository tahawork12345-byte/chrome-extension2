-- CreateTable
CREATE TABLE "SyncDoc" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncDoc_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "SyncDoc" ADD CONSTRAINT "SyncDoc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
