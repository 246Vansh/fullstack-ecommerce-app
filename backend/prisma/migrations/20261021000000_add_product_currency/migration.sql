-- AlterTable
-- Every existing product is priced in USD; the default records that without
-- changing any price. New products may be created in INR (set once, never
-- changed). Orders already store their own currency and are not touched.
ALTER TABLE `products` ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'USD';
