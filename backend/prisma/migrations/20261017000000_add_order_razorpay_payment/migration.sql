-- AlterTable
ALTER TABLE `orders` ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentMethod` ENUM('COD', 'RAZORPAY') NOT NULL DEFAULT 'COD',
    ADD COLUMN `razorpayOrderId` VARCHAR(64) NULL,
    ADD COLUMN `razorpayPaymentId` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `orders_razorpayOrderId_key` ON `orders`(`razorpayOrderId`);

-- CreateIndex
CREATE UNIQUE INDEX `orders_razorpayPaymentId_key` ON `orders`(`razorpayPaymentId`);

