-- Add passwordHash column to users table
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;

-- Create sessions table for Lucia authentication
CREATE TABLE "sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Create index on userId for faster lookups
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- Add indexes to users table for faster lookups
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
