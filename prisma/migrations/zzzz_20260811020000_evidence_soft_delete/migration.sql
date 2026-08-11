-- Phase 4: evidence safe deletion and metadata updates.
ALTER TABLE "evidence"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedBy" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "evidence"
  ADD CONSTRAINT "evidence_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "evidence_deletedBy_idx" ON "evidence"("deletedBy");
CREATE INDEX "evidence_deletedAt_idx" ON "evidence"("deletedAt");
