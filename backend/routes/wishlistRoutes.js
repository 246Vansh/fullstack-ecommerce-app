import { Router } from "express";
import { param } from "express-validator";

import { addToMyWishlist, getMyWishlist, removeFromMyWishlist } from "../controllers/wishlistController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { wishlistMutationLimiter } from "../middleware/rateLimits.js";

const router = Router();

const MAX_ID = 2147483647; // INT column

const productIdRules = [
    param("productId").isInt({ min: 1, max: MAX_ID }).withMessage("Product id must be a positive integer").toInt(),
];

// Every user sees and changes only their own wishlist.
router.use(authenticate);

router.get("/", getMyWishlist);
// PUT/DELETE on the product: both idempotent, so retries and double clicks are safe.
router.put("/:productId", wishlistMutationLimiter, productIdRules, validate, addToMyWishlist);
router.delete("/:productId", wishlistMutationLimiter, productIdRules, validate, removeFromMyWishlist);

export default router;
