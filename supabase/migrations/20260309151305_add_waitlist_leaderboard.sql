-- Add waitlist leaderboard fields to User table
ALTER TABLE "User" ADD COLUMN "bonusPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "hasSharedToX" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "sharedToXAt" TIMESTAMP(3);

-- Add index on createdAt for efficient leaderboard sorting
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
