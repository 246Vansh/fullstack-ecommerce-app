-- Public coupon codes. Additive only: a new table, two nullable columns on
-- orders (every existing order gets NULL: no coupon) and an index and foreign
-- key for them. No existing row's values change.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `couponCode` VARCHAR(40) NULL,
    ADD COLUMN `couponId` INTEGER NULL;

-- CreateTable
CREATE TABLE `coupons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `description` VARCHAR(255) NULL,
    `discountType` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `discountValue` DECIMAL(10, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `minimumOrderAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `maximumDiscountAmount` DECIMAL(10, 2) NULL,
    `usageLimit` INTEGER UNSIGNED NULL,
    `usageLimitPerUser` INTEGER UNSIGNED NULL,
    `usedCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupons_code_key`(`code`),
    INDEX `coupons_isActive_createdAt_idx`(`isActive`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_couponId_userId_idx` ON `orders`(`couponId`, `userId`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
