-- DropForeignKey
ALTER TABLE "findings" DROP CONSTRAINT "findings_testSessionId_fkey";

-- AlterTable
ALTER TABLE "evidence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "support_links" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_links_findingId_idx" ON "support_links"("findingId");

-- CreateIndex
CREATE INDEX "support_links_createdBy_idx" ON "support_links"("createdBy");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_links" ADD CONSTRAINT "support_links_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_links" ADD CONSTRAINT "support_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
