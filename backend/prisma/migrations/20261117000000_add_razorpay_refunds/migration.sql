-- Refund reconciliation: every processed Razorpay refund is stored once
-- (razorpay_refunds, keyed by Razorpay's refund id), so partial refunds can
-- be summed, a refund that arrives before its payment's capture is kept until
-- it can be matched, and each refund's customer email is sent from a durable
-- outbox. Orders get an auditable admin acknowledgement of a partial refund.
-- Additive: four nullable columns on orders, one new table, a backfill.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `refundReviewedAmount` INTEGER UNSIGNED NULL,
    ADD COLUMN `refundReviewedAt` DATETIME(3) NULL,
    ADD COLUMN `refundReviewedById` INTEGER NULL,
    ADD COLUMN `refundReviewedCount` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `razorpay_refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `razorpayRefundId` VARCHAR(64) NOT NULL,
    `razorpayPaymentId` VARCHAR(64) NOT NULL,
    `amount` INTEGER UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `settledAt` DATETIME(3) NULL,
    `orderId` INTEGER NULL,
    `emailDueAt` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `emailAttempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `emailLockedUntil` DATETIME(3) NULL,
    `emailLastError` VARCHAR(40) NULL,

    UNIQUE INDEX `razorpay_refunds_razorpayRefundId_key`(`razorpayRefundId`),
    INDEX `razorpay_refunds_razorpayPaymentId_idx`(`razorpayPaymentId`),
    INDEX `razorpay_refunds_settledAt_idx`(`settledAt`),
    INDEX `razorpay_refunds_orderId_idx`(`orderId`),
    INDEX `razorpay_refunds_emailSentAt_emailDueAt_idx`(`emailSentAt`, `emailDueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: refunds already confirmed by the previous code (a full refund of
-- an unapplied payment, recorded on that row). They are settled, and their
-- email was already sent by that code, so the outbox never sends it again.
INSERT INTO `razorpay_refunds`
    (`razorpayRefundId`, `razorpayPaymentId`, `amount`, `currency`, `receivedAt`, `settledAt`, `orderId`, `emailSentAt`)
SELECT `razorpayRefundId`, `razorpayPaymentId`, `amount`, `currency`, `refundedAt`, `refundedAt`, `orderId`, `refundedAt`
FROM `unapplied_payments`
WHERE `razorpayRefundId` IS NOT NULL AND `refundedAt` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_refundReviewedById_fkey` FOREIGN KEY (`refundReviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `razorpay_refunds` ADD CONSTRAINT `razorpay_refunds_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
