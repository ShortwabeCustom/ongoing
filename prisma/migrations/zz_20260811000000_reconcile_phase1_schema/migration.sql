-- Phase 1 schema reconciliation.
-- This migration is designed to preserve existing validation/audit data where possible.

-- CreateEnum
DROP TYPE IF EXISTS "ResolutionState";
CREATE TYPE "ResolutionState" AS ENUM ('OPEN', 'TRIAGED', 'INVESTIGATING', 'PROPOSED', 'APPROVED', 'IMPLEMENTED', 'VERIFIED', 'CLOSED');

-- AlterEnum: ValidationResult PASSED/FAILED/PARTIAL -> PASS/FAIL/PENDING
ALTER TABLE "validations" ALTER COLUMN "result" DROP DEFAULT;
ALTER TABLE "validations" ALTER COLUMN "result" TYPE TEXT USING (
  CASE "result"::text
    WHEN 'PASSED' THEN 'PASS'
    WHEN 'FAILED' THEN 'FAIL'
    WHEN 'PARTIAL' THEN 'PENDING'
    ELSE "result"::text
  END
);
DROP TYPE "ValidationResult";
CREATE TYPE "ValidationResult" AS ENUM ('PENDING', 'PASS', 'FAIL');
ALTER TABLE "validations" ALTER COLUMN "result" TYPE "ValidationResult" USING ("result"::"ValidationResult");

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actorId_fkey";
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_createdBy_fkey";
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_findingId_fkey";
ALTER TABLE "evidence" DROP CONSTRAINT IF EXISTS "evidence_createdBy_fkey";
ALTER TABLE "evidence" DROP CONSTRAINT IF EXISTS "evidence_findingId_fkey";
ALTER TABLE "finding_experience_tags" DROP CONSTRAINT IF EXISTS "finding_experience_tags_findingId_fkey";
ALTER TABLE "finding_incidence_types" DROP CONSTRAINT IF EXISTS "finding_incidence_types_findingId_fkey";
ALTER TABLE "finding_status_history" DROP CONSTRAINT IF EXISTS "finding_status_history_changedBy_fkey";
ALTER TABLE "finding_status_history" DROP CONSTRAINT IF EXISTS "finding_status_history_findingId_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_assigneeId_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_createdBy_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_importBatchId_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_projectId_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_testSessionId_fkey";
ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_updatedBy_fkey";
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_importedBy_fkey";
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_projectId_fkey";
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_testSessionId_fkey";
ALTER TABLE "product_versions" DROP CONSTRAINT IF EXISTS "product_versions_projectId_fkey";
ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_projectId_fkey";
ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_userId_fkey";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_ownerId_fkey";
ALTER TABLE "resolutions" DROP CONSTRAINT IF EXISTS "resolutions_createdBy_fkey";
ALTER TABLE "resolutions" DROP CONSTRAINT IF EXISTS "resolutions_findingId_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
ALTER TABLE "test_sessions" DROP CONSTRAINT IF EXISTS "test_sessions_createdBy_fkey";
ALTER TABLE "test_sessions" DROP CONSTRAINT IF EXISTS "test_sessions_projectId_fkey";
ALTER TABLE "test_sessions" DROP CONSTRAINT IF EXISTS "test_sessions_versionId_fkey";
ALTER TABLE "validations" DROP CONSTRAINT IF EXISTS "validations_findingId_fkey";
ALTER TABLE "validations" DROP CONSTRAINT IF EXISTS "validations_validatedBy_fkey";

-- DropIndex
DROP INDEX IF EXISTS "findings_createdAt_idx";

-- DropUniqueConstraint
ALTER TABLE "resolutions" DROP CONSTRAINT IF EXISTS "resolutions_findingId_key";
ALTER TABLE "validations" DROP CONSTRAINT IF EXISTS "validations_findingId_key";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "actorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN "resolutionId" TEXT,
ADD COLUMN "validationId" TEXT;

-- AlterTable
ALTER TABLE "resolutions" ADD COLUMN "assignedTo" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "state" "ResolutionState" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "validations" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "criteria" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "result" SET DEFAULT 'PENDING',
ALTER COLUMN "validatedBy" DROP NOT NULL,
ALTER COLUMN "validatedAt" DROP NOT NULL,
ALTER COLUMN "validatedAt" DROP DEFAULT;
ALTER TABLE "validations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
CREATE INDEX "push_subscriptions_createdAt_idx" ON "push_subscriptions"("createdAt");
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "evidence_resolutionId_idx" ON "evidence"("resolutionId");
CREATE INDEX "evidence_validationId_idx" ON "evidence"("validationId");
CREATE INDEX "finding_status_history_toStatus_changedAt_idx" ON "finding_status_history"("toStatus", "changedAt");
CREATE INDEX "findings_createdAt_idx" ON "findings"("createdAt");
CREATE INDEX "findings_createdAt_status_idx" ON "findings"("createdAt", "status");
CREATE INDEX "resolutions_state_idx" ON "resolutions"("state");
CREATE INDEX "resolutions_assignedTo_idx" ON "resolutions"("assignedTo");
CREATE INDEX "validations_result_idx" ON "validations"("result");
CREATE INDEX "validations_result_validatedAt_idx" ON "validations"("result", "validatedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "product_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finding_incidence_types" ADD CONSTRAINT "finding_incidence_types_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_experience_tags" ADD CONSTRAINT "finding_experience_tags_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "validations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validations" ADD CONSTRAINT "validations_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validations" ADD CONSTRAINT "validations_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finding_status_history" ADD CONSTRAINT "finding_status_history_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_status_history" ADD CONSTRAINT "finding_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
