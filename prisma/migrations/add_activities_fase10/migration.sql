-- CreateEnum for ActivityAction
CREATE TYPE "ActivityAction" AS ENUM ('FINDING_CREATED', 'FINDING_UPDATED', 'FINDING_DELETED', 'FINDING_VIEWED', 'RESOLUTION_ADDED', 'RESOLUTION_UPDATED', 'VALIDATION_COMPLETED', 'COMMENT_ADDED', 'STATUS_CHANGED', 'ASSIGNED');

-- CreateEnum for UserStatus
CREATE TYPE "UserStatus" AS ENUM ('ONLINE', 'EDITING', 'IDLE', 'OFFLINE');

-- CreateTable activities
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on activities
CREATE INDEX "activities_userId_idx" ON "activities"("userId");
CREATE INDEX "activities_resourceId_idx" ON "activities"("resourceId");
CREATE INDEX "activities_action_idx" ON "activities"("action");
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- AddForeignKey to activities
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
