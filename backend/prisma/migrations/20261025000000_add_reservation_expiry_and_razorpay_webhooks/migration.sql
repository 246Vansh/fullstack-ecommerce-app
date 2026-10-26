-- Online orders hold their stock for 30 minutes (reservationExpiresAt); the
-- expiry worker cancels unpaid ones after that and records expiredAt.
-- Additive: two nullable columns, one index and two new tables.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `expiredAt` DATETIME(3) NULL,
    ADD COLUMN `reservationExpiresAt` DATETIME(3) NULL;

-- Existing online orders get the same 30-minute window from when they were
-- placed. Paid, cancelled and progressed orders are never touched by the
-- worker; still-unpaid PENDING ones older than 30 minutes become due on the
-- first sweep after deployment (the worker asks Razorpay about any with a
-- gateway order before cancelling them). Cash-on-delivery orders keep NULL.
UPDATE `orders`
SET `reservationExpiresAt` = DATE_ADD(`createdAt`, INTERVAL 30 MINUTE)
WHERE `paymentMethod` = 'RAZORPAY';

-- CreateTable
CREATE TABLE `unapplied_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `razorpayPaymentId` VARCHAR(64) NOT NULL,
    `razorpayOrderId` VARCHAR(64) NOT NULL,
    `amount` INTEGER UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `reason` VARCHAR(40) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `refundedAt` DATETIME(3) NULL,
    `razorpayRefundId` VARCHAR(64) NULL,

    UNIQUE INDEX `unapplied_payments_razorpayPaymentId_key`(`razorpayPaymentId`),
    UNIQUE INDEX `unapplied_payments_razorpayRefundId_key`(`razorpayRefundId`),
    INDEX `unapplied_payments_orderId_idx`(`orderId`),
    INDEX `unapplied_payments_refundedAt_idx`(`refundedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `razorpay_webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventKey` VARCHAR(80) NOT NULL,
    `event` VARCHAR(64) NOT NULL,
    `razorpayOrderId` VARCHAR(64) NULL,
    `razorpayPaymentId` VARCHAR(64) NULL,
    `outcome` VARCHAR(40) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `razorpay_webhook_events_eventKey_key`(`eventKey`),
    INDEX `razorpay_webhook_events_razorpayOrderId_idx`(`razorpayOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_status_reservationExpiresAt_idx` ON `orders`(`status`, `reservationExpiresAt`);

-- AddForeignKey
ALTER TABLE `unapplied_payments` ADD CONSTRAINT `unapplied_payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
