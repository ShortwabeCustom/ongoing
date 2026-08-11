-- Phase 2 importer idempotency.
ALTER TABLE "findings" ADD COLUMN "sourceFingerprint" TEXT;
CREATE UNIQUE INDEX "findings_sourceFingerprint_key" ON "findings"("sourceFingerprint");

-- Allow multiple import batches per test session.
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_testSessionId_key";
