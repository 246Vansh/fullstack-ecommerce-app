-- AlterTable
-- Absolute session expiry, copied to every token of a session. Existing rows
-- get their current expiresAt: their sessions can no longer be extended, so
-- each ends within one refresh-token lifetime (7 days by default), and nobody
-- is signed out now. Only refresh_tokens is touched.
ALTER TABLE `refresh_tokens` ADD COLUMN `sessionExpiresAt` DATETIME(3) NULL;

UPDATE `refresh_tokens` SET `sessionExpiresAt` = `expiresAt`;

ALTER TABLE `refresh_tokens` MODIFY `sessionExpiresAt` DATETIME(3) NOT NULL;
