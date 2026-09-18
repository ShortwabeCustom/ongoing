-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('FINDING', 'IMPROVEMENT', 'INCIDENT');

-- CreateEnum
CREATE TYPE "InterfaceMode" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "findingType" "FindingType",
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "jiraId" TEXT,
ADD COLUMN     "interfaceMode" "InterfaceMode",
ADD COLUMN     "approvalInternal" BOOLEAN,
ADD COLUMN     "approvalBusiness" BOOLEAN,
ADD COLUMN     "approvalTech" BOOLEAN;

-- CreateIndex
CREATE INDEX "findings_findingType_idx" ON "findings"("findingType");

-- CreateIndex
CREATE INDEX "findings_channel_idx" ON "findings"("channel");
