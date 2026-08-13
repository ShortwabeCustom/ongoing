-- AlterEnum
ALTER TYPE "ExperienceTag" ADD VALUE 'DEV';

-- DropForeignKey
ALTER TABLE "findings" DROP CONSTRAINT "findings_testSessionId_fkey";

-- AlterTable
ALTER TABLE "evidence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "findings" ALTER COLUMN "testSessionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
