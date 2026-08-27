-- CreateEnum
CREATE TYPE "EvidenceVisibility" AS ENUM ('PRIVATE', 'PUBLIC_REPORT');

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "visibility" "EvidenceVisibility" NOT NULL DEFAULT 'PRIVATE';
