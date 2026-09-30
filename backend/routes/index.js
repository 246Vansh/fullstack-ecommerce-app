import { Router } from "express";

import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import productRoutes from "./productRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import cartRoutes from "./cartRoutes.js";
import addressRoutes from "./addressRoutes.js";
import checkoutRoutes from "./checkoutRoutes.js";
import orderRoutes from "./orderRoutes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/cart", cartRoutes);
router.use("/addresses", addressRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/orders", orderRoutes);

export default router;
