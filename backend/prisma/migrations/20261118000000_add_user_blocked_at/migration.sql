-- AlterTable
-- Admin user management: when an admin blocked the account (NULL = not
-- blocked). Additive and nullable, so every existing user stays unblocked and
-- the running code is unaffected; apply it before deploying code that reads it.
-- Only users is touched.
ALTER TABLE `users` ADD COLUMN `blockedAt` DATETIME(3) NULL;
