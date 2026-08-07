-- CreateEnum for UserRole
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER');

-- CreateEnum for FindingStatus
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED');

-- CreateEnum for FindingPriority
CREATE TYPE "FindingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum for FindingSeverity
CREATE TYPE "FindingSeverity" AS ENUM ('COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER');

-- CreateEnum for FindingEffort
CREATE TYPE "FindingEffort" AS ENUM ('S', 'M', 'L', 'XL');

-- CreateEnum for IncidenceType
CREATE TYPE "IncidenceType" AS ENUM ('DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY');

-- CreateEnum for ExperienceTag
CREATE TYPE "ExperienceTag" AS ENUM ('UI', 'UX', 'COPY');

-- CreateEnum for EvidenceType
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'FIGMA_URL', 'EXTERNAL_URL');

-- CreateEnum for ValidationResult
CREATE TYPE "ValidationResult" AS ENUM ('PASSED', 'FAILED', 'PARTIAL');

-- CreateEnum for AuditAction
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'VALIDATE', 'RESOLVE', 'IMPORT');

-- CreateEnum for ImportStatus
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateTable users
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- CreateTable projects
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");
CREATE INDEX "projects_deletedAt_idx" ON "projects"("deletedAt");

-- CreateTable project_members
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "project_members_projectId_userId_key" UNIQUE ("projectId", "userId")
);

CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateTable product_versions
CREATE TABLE "product_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "product_versions_projectId_version_key" UNIQUE ("projectId", "version")
);

CREATE INDEX "product_versions_projectId_idx" ON "product_versions"("projectId");

-- CreateTable test_sessions
CREATE TABLE "test_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "environment" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "test_sessions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "product_versions" ("id") ON DELETE CASCADE,
    CONSTRAINT "test_sessions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id")
);

CREATE INDEX "test_sessions_projectId_idx" ON "test_sessions"("projectId");
CREATE INDEX "test_sessions_versionId_idx" ON "test_sessions"("versionId");
CREATE INDEX "test_sessions_createdBy_idx" ON "test_sessions"("createdBy");

-- CreateTable findings
CREATE TABLE "findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "folio" TEXT,
    "observation" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "priority" "FindingPriority" NOT NULL DEFAULT 'MEDIUM',
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "effort" "FindingEffort" NOT NULL DEFAULT 'M',
    "previousScreen" TEXT,
    "currentScreen" TEXT,
    "flowStep" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "importBatchId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "findings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "findings_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions" ("id") ON DELETE CASCADE,
    CONSTRAINT "findings_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL,
    CONSTRAINT "findings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id"),
    CONSTRAINT "findings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users" ("id") ON DELETE SET NULL,
    CONSTRAINT "findings_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches" ("id") ON DELETE SET NULL
);

CREATE INDEX "findings_projectId_idx" ON "findings"("projectId");
CREATE INDEX "findings_testSessionId_idx" ON "findings"("testSessionId");
CREATE INDEX "findings_status_idx" ON "findings"("status");
CREATE INDEX "findings_priority_idx" ON "findings"("priority");
CREATE INDEX "findings_assigneeId_idx" ON "findings"("assigneeId");
CREATE INDEX "findings_createdAt_idx" ON "findings"("createdAt" DESC);
CREATE INDEX "findings_importBatchId_idx" ON "findings"("importBatchId");
CREATE INDEX "findings_deletedAt_idx" ON "findings"("deletedAt");

-- CreateTable finding_incidence_types
CREATE TABLE "finding_incidence_types" (
    "findingId" TEXT NOT NULL,
    "incidenceType" "IncidenceType" NOT NULL,
    CONSTRAINT "finding_incidence_types_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("findingId", "incidenceType")
);

CREATE INDEX "finding_incidence_types_findingId_idx" ON "finding_incidence_types"("findingId");

-- CreateTable finding_experience_tags
CREATE TABLE "finding_experience_tags" (
    "findingId" TEXT NOT NULL,
    "experienceTag" "ExperienceTag" NOT NULL,
    CONSTRAINT "finding_experience_tags_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("findingId", "experienceTag")
);

CREATE INDEX "finding_experience_tags_findingId_idx" ON "finding_experience_tags"("findingId");

-- CreateTable evidence
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "caption" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    CONSTRAINT "evidence_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id")
);

CREATE INDEX "evidence_findingId_idx" ON "evidence"("findingId");
CREATE INDEX "evidence_createdBy_idx" ON "evidence"("createdBy");

-- CreateTable resolutions
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resolutions_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    CONSTRAINT "resolutions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id"),
    CONSTRAINT "resolutions_findingId_key" UNIQUE ("findingId")
);

CREATE INDEX "resolutions_findingId_idx" ON "resolutions"("findingId");
CREATE INDEX "resolutions_createdBy_idx" ON "resolutions"("createdBy");

-- CreateTable validations
CREATE TABLE "validations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "result" "ValidationResult" NOT NULL,
    "notes" TEXT,
    "validatedBy" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "validations_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    CONSTRAINT "validations_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "users" ("id"),
    CONSTRAINT "validations_findingId_key" UNIQUE ("findingId")
);

CREATE INDEX "validations_findingId_idx" ON "validations"("findingId");
CREATE INDEX "validations_validatedBy_idx" ON "validations"("validatedBy");

-- CreateTable comments
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comments_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    CONSTRAINT "comments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id")
);

CREATE INDEX "comments_findingId_idx" ON "comments"("findingId");
CREATE INDEX "comments_createdBy_idx" ON "comments"("createdBy");

-- CreateTable finding_status_history
CREATE TABLE "finding_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "fromStatus" "FindingStatus" NOT NULL,
    "toStatus" "FindingStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finding_status_history_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings" ("id") ON DELETE CASCADE,
    CONSTRAINT "finding_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users" ("id")
);

CREATE INDEX "finding_status_history_findingId_idx" ON "finding_status_history"("findingId");
CREATE INDEX "finding_status_history_changedBy_idx" ON "finding_status_history"("changedBy");

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id")
);

CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateTable import_batches
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "skippedRows" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "errorMessage" TEXT,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "import_batches_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions" ("id") ON DELETE CASCADE,
    CONSTRAINT "import_batches_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "users" ("id"),
    CONSTRAINT "import_batches_testSessionId_key" UNIQUE ("testSessionId")
);

CREATE INDEX "import_batches_projectId_idx" ON "import_batches"("projectId");
CREATE INDEX "import_batches_importedBy_idx" ON "import_batches"("importedBy");
