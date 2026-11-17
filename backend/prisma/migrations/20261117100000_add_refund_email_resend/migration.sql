-- Admin resend of an exhausted refund email: who asked, and when.
-- Additive: two nullable columns on razorpay_refunds and their foreign key.
-- razorpay_refunds is new in 20261117000000_add_razorpay_refunds, so this
-- rebuild (if MySQL copies the table for the foreign key) is of a small table.

-- AlterTable
ALTER TABLE `razorpay_refunds` ADD COLUMN `emailResendRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `emailResendRequestedById` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `razorpay_refunds` ADD CONSTRAINT `razorpay_refunds_emailResendRequestedById_fkey` FOREIGN KEY (`emailResendRequestedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
