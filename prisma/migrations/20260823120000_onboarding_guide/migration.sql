-- First-run guide state.
--
-- Both columns are nullable and default to NULL, which is what marks an
-- account as "has never seen the guide" — exactly right for accounts
-- created from here on.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "guideDismissedAt" TIMESTAMP(3);

-- Everyone who already had an account has, by definition, already found
-- their way around; dropping them into a welcome wizard on their next visit
-- would be worse than not shipping one. Stamped with createdAt rather than
-- now() so the column keeps meaning "since when did this user know the app".
UPDATE "User" SET "onboardedAt" = "createdAt";
