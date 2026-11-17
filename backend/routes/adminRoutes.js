import { Router } from "express";
import { body, param, query, matchedData } from "express-validator";

import {
    listProducts, getProduct, createProduct, updateProduct, deactivateProduct, replaceImages,
    createVariant, updateVariant, deactivateVariant,
    listCategories, createCategory, updateCategory,
} from "../controllers/adminCatalogController.js";
import { listOrders, getOrder, updateOrderStatus, acknowledgeOrderRefund, resendOrderRefundEmail } from "../controllers/adminOrderController.js";
import {
    listCoupons, getCoupon, createCoupon, updateCoupon, activateCoupon, deactivateCoupon, deleteCoupon,
} from "../controllers/adminCouponController.js";
import { ADMIN_COUPON_PAGINATION, COUPON_CODE } from "../services/couponService.js";
import { ADMIN_PAGINATION, MAX_STOCK } from "../services/adminCatalogService.js";
import { ADMIN_ORDER_PAGINATION, FULFILMENT_STEPS, ORDER_STATUSES } from "../services/orderService.js";
import { CURRENCIES } from "../services/pricingService.js";
import { authenticate, authorize, requireCurrentAdmin } from "../middleware/auth.js";
import { paginationRules, singleQuery, validate } from "../middleware/validate.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

// Every route below: a valid access token, ADMIN in that token (cheap
// rejection of customers), then ADMIN in the database right now. The role
// only ever comes from the signed token and the users table; nothing in the
// request body, query or headers is consulted.
router.use(authenticate, authorize("ADMIN"), requireCurrentAdmin);

// ------------------------------------------------------------ field rules

const MAX_ID = 2147483647; // INT column
const MAX_TEXT = 5000;
// Decimal(10, 2): up to 8 integer digits and 2 decimals, strictly positive.
const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9][A-Z0-9._-]*$/;
const HEX = /^#[0-9A-F]{6}$/;

const label = (path) => path.split(".").pop();

// Required fields must be present; optional ones may be left out. null is
// only accepted where the field is nullable (to clear it).
const start = (path, required) => (required
    ? body(path).exists().withMessage(`${label(path)} is required`).bail()
    : body(path).optional());

function text(path, { max, required = false, nullable = false, pattern, message, upper = false, lower = false }) {
    return start(path, required)
        .custom((value) => (nullable && value === null) || typeof value === "string")
        .withMessage(`${label(path)} must be a string${nullable ? " or null" : ""}`).bail()
        .customSanitizer((value) => {
            if (value === null) return null;
            let normalized = value.trim();
            if (upper) normalized = normalized.toUpperCase();
            if (lower) normalized = normalized.toLowerCase();
            return nullable && normalized === "" ? null : normalized;
        })
        .custom((value) => value === null || (value.length > 0 && value.length <= max && (!pattern || pattern.test(value))))
        .withMessage(message ?? `${label(path)} must be 1-${max} characters`);
}

const isHttpsUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
        return false;
    }
};

const url = (path, options) => text(path, { max: 500, message: `${label(path)} must be an https URL of at most 500 characters`, ...options })
    .custom((value) => value === null || isHttpsUrl(value))
    .withMessage(`${label(path)} must be an https URL of at most 500 characters`);

// Numbers or numeric strings; floats like 0.1 + 0.2 are refused rather than rounded.
const money = (path, { required = false, nullable = false } = {}) => start(path, required)
    .custom((value) => (nullable && value === null)
        || ((typeof value === "number" || typeof value === "string") && MONEY.test(String(value).trim()) && Number(value) > 0))
    .withMessage(`${label(path)} must be a positive amount with at most 2 decimals (max 99999999.99)${nullable ? ", or null" : ""}`)
    .customSanitizer((value) => (value === null ? null : String(value).trim()));

const integer = (path, { required = false, min, max, message }) => start(path, required)
    .custom((value) => value !== null && typeof value !== "boolean").withMessage(message).bail()
    .isInt({ min, max }).withMessage(message)
    .toInt();

const id = (path, options = {}) => integer(path, { min: 1, max: MAX_ID, message: `${label(path)} must be a positive integer`, ...options });

const nullableId = (path) => body(path).optional()
    .custom((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= MAX_ID))
    .withMessage(`${label(path)} must be a positive integer or null`);

const flag = (path) => body(path).optional()
    .custom((value) => typeof value === "boolean").withMessage(`${label(path)} must be true or false`);

const stock = (path) => integer(path, { min: 0, max: MAX_STOCK, message: `${label(path)} must be a whole number from 0 to ${MAX_STOCK}` });

// ------------------------------------------------------------ resource rules

const productFields = ({ required }) => [
    text("name", { max: 200, required }),
    text("slug", { max: 220, lower: true, pattern: SLUG, message: "slug must be lowercase letters, numbers and single hyphens (max 220)" }),
    text("description", { max: MAX_TEXT, nullable: true }),
    text("brand", { max: 100, nullable: true }),
    money("price", { required }),
    money("originalPrice", { nullable: true }),
    flag("isNew"),
    flag("isActive"),
    id("categoryId", { required }),
];

const variantFields = (prefix, { required }) => [
    text(`${prefix}sku`, { max: 100, required, upper: true, pattern: SKU, message: "sku must be letters, numbers, '.', '_' or '-' (max 100)" }),
    text(`${prefix}size`, { max: 20, nullable: true }),
    text(`${prefix}color`, { max: 50, nullable: true }),
    text(`${prefix}colorHex`, { max: 7, nullable: true, upper: true, pattern: HEX, message: "colorHex must look like #1A2B3C" }),
    money(`${prefix}price`, { nullable: true }),
    money(`${prefix}originalPrice`, { nullable: true }),
    stock(`${prefix}stock`),
    flag(`${prefix}isActive`),
];

const imageFields = (prefix) => [
    url(`${prefix}url`, { required: true }),
    text(`${prefix}altText`, { max: 200, nullable: true }),
];

const imagesArray = (required) => (required ? body("images").exists().withMessage("images is required").bail() : body("images").optional())
    .isArray({ max: 20 }).withMessage("images must be a list of at most 20 images");

const categoryFields = ({ required }) => [
    text("name", { max: 100, required }),
    text("slug", { max: 120, lower: true, pattern: SLUG, message: "slug must be lowercase letters, numbers and single hyphens (max 120)" }),
    text("description", { max: MAX_TEXT, nullable: true }),
    url("image", { nullable: true }),
    nullableId("parentId"),
    flag("isActive"),
];

const idParam = param("id").isInt({ min: 1, max: MAX_ID }).withMessage("id must be a positive integer").toInt();

// A PATCH must change at least one known field.
function requireChanges(req, res, next) {
    const changes = matchedData(req, { locations: ["body"] });

    if (Object.keys(changes).length === 0) {
        return next(new ApiError(422, "No changes provided"));
    }

    next();
}

const listRules = [
    ...paginationRules(ADMIN_PAGINATION),
    query("search").optional().isString().trim().isLength({ max: 100 }).withMessage("search must be at most 100 characters"),
    singleQuery("isActive").optional().isIn(["true", "false"]).withMessage("isActive must be true or false").toBoolean(true),
    singleQuery("categoryId").optional().isInt({ min: 1, max: MAX_ID }).withMessage("categoryId must be a positive integer").toInt(),
];

// The currency of every price on the product and its variants: chosen once, on
// create (USD when left out). Changing it would reinterpret the stored prices,
// so an update that sends it is refused rather than silently ignored.
const currencyOnCreate = body("currency").optional()
    .isIn(CURRENCIES).withMessage(`currency must be one of: ${CURRENCIES.join(", ")}`);

// optional() keeps an absent currency out of matchedData, or requireChanges
// would count it as a change and accept an empty PATCH.
const currencyFixed = body("currency").optional().not().exists()
    .withMessage("currency is set when a product is created and cannot be changed");

const createProductRules = [
    ...productFields({ required: true }),
    currencyOnCreate,
    body("variants").exists().withMessage("variants is required").bail()
        .isArray({ min: 1, max: 100 }).withMessage("variants must be a list of 1 to 100 variants"),
    ...variantFields("variants.*.", { required: true }),
    imagesArray(false),
    ...imageFields("images.*."),
];

const updateVariantRules = [
    idParam,
    ...variantFields("", { required: false }),
    integer("stockAdjustment", {
        min: -MAX_STOCK, max: MAX_STOCK,
        message: `stockAdjustment must be a non-zero whole number between -${MAX_STOCK} and ${MAX_STOCK}`,
    })
        .custom((value) => value !== 0).withMessage("stockAdjustment must not be 0")
        .custom((value, { req }) => req.body.stock === undefined).withMessage("Send either stock or stockAdjustment, not both"),
];

const orderListRules = [
    ...paginationRules(ADMIN_ORDER_PAGINATION),
    singleQuery("status").optional().isIn(ORDER_STATUSES).withMessage(`status must be one of: ${ORDER_STATUSES.join(", ")}`),
    // true: only orders with a captured payment still waiting for a refund
    // (unapplied_payments without refundedAt); false: only orders without one.
    singleQuery("refundDue").optional().isIn(["true", "false"]).withMessage("refundDue must be true or false").toBoolean(true),
];

// ------------------------------------------------------------ coupons

const MAX_USES = 1_000_000_000;

// Zero allowed (no minimum).
const amountOrZero = (path) => body(path).optional()
    .custom((value) => (typeof value === "number" || typeof value === "string") && MONEY.test(String(value).trim()))
    .withMessage(`${label(path)} must be an amount from 0 with at most 2 decimals (max 99999999.99)`)
    .customSanitizer((value) => String(value).trim());

const nullableCount = (path) => body(path).optional()
    .custom((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= MAX_USES))
    .withMessage(`${label(path)} must be a whole number from 1 to ${MAX_USES}, or null for no limit`);

const dateTime = (path, { nullable }) => body(path).optional()
    .custom((value) => (nullable && value === null)
        || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))))
    .withMessage(`${label(path)} must be an ISO 8601 date-time${nullable ? " or null" : ""}`)
    .customSanitizer((value) => (value === null ? null : new Date(value)));

const couponFields = ({ required }) => [
    text("code", { max: 40, required, upper: true, pattern: COUPON_CODE, message: "code must be 3-40 letters, numbers, '-' or '_'" }),
    text("description", { max: 255, nullable: true }),
    (required ? body("discountType").exists().withMessage("discountType is required").bail() : body("discountType").optional())
        .isIn(["PERCENTAGE", "FIXED"]).withMessage("discountType must be PERCENTAGE or FIXED"),
    money("discountValue", { required }),
    (required ? body("currency").exists().withMessage("currency is required").bail() : body("currency").optional())
        .isIn(CURRENCIES).withMessage(`currency must be one of: ${CURRENCIES.join(", ")}`),
    amountOrZero("minimumOrderAmount"),
    money("maximumDiscountAmount", { nullable: true }),
    nullableCount("usageLimit"),
    nullableCount("usageLimitPerUser"),
    dateTime("startsAt", { nullable: false }),
    dateTime("expiresAt", { nullable: true }),
    flag("isActive"),
];

const couponListRules = [
    ...paginationRules(ADMIN_COUPON_PAGINATION),
    singleQuery("search").optional().isString().trim().isLength({ max: 40 }).withMessage("search must be at most 40 characters"),
    singleQuery("isActive").optional().isIn(["true", "false"]).withMessage("isActive must be true or false").toBoolean(true),
];

// Only the step requested; the server derives which status it must follow.
const orderStatusRules = [
    idParam,
    body("status").exists().withMessage("status is required").bail()
        .isIn(FULFILMENT_STEPS.slice(1)).withMessage(`status must be one of: ${FULFILMENT_STEPS.slice(1).join(", ")}`),
];

// The refund state the admin was shown: both must match the current one.
const refundReviewRules = [
    idParam,
    body("refundCount").exists().withMessage("refundCount is required").bail()
        .isInt({ min: 1, max: 1_000_000 }).withMessage("refundCount must be a positive integer").toInt(),
    body("refundedAmount").exists().withMessage("refundedAmount is required").bail()
        .isInt({ min: 0, max: 1_000_000_000_000 }).withMessage("refundedAmount must be a non-negative integer (minor units)").toInt(),
];

// A Razorpay refund id of this order.
const refundEmailResendRules = [
    idParam,
    param("refundId").matches(/^rfnd_[A-Za-z0-9]{1,40}$/).withMessage("refundId must be a Razorpay refund id"),
];

// ------------------------------------------------------------ routes

router.get("/products", listRules, validate, listProducts);
router.post("/products", createProductRules, validate, createProduct);
router.get("/products/:id", idParam, validate, getProduct);
router.patch("/products/:id", idParam, productFields({ required: false }), currencyFixed, validate, requireChanges, updateProduct);
// Soft delete (isActive = false); products are never removed from order history.
router.delete("/products/:id", idParam, validate, deactivateProduct);
router.put("/products/:id/images", idParam, imagesArray(true), imageFields("images.*."), validate, replaceImages);

router.post("/products/:id/variants", idParam, variantFields("", { required: true }), validate, createVariant);
router.patch("/variants/:id", updateVariantRules, validate, requireChanges, updateVariant);
router.delete("/variants/:id", idParam, validate, deactivateVariant);

router.get("/categories", listCategories);
router.post("/categories", categoryFields({ required: true }), validate, createCategory);
router.patch("/categories/:id", idParam, categoryFields({ required: false }), validate, requireChanges, updateCategory);

// Orders are never created, edited or deleted here: only read, and moved
// forward through fulfilment one step at a time.
router.get("/orders", orderListRules, validate, listOrders);
router.get("/orders/:id", idParam, validate, getOrder);
router.patch("/orders/:id/status", orderStatusRules, validate, updateOrderStatus);
router.post("/orders/:id/refund-review", refundReviewRules, validate, acknowledgeOrderRefund);
router.post("/orders/:id/refunds/:refundId/resend-email", refundEmailResendRules, validate, resendOrderRefundEmail);

// Coupons. usedCount is changed only by orders, never through these routes.
router.get("/coupons", couponListRules, validate, listCoupons);
router.post("/coupons", couponFields({ required: true }), validate, createCoupon);
router.get("/coupons/:id", idParam, validate, getCoupon);
router.patch("/coupons/:id", idParam, couponFields({ required: false }), validate, requireChanges, updateCoupon);
router.post("/coupons/:id/activate", idParam, validate, activateCoupon);
router.post("/coupons/:id/deactivate", idParam, validate, deactivateCoupon);
// Only a coupon no order has used; others can only be deactivated.
router.delete("/coupons/:id", idParam, validate, deleteCoupon);

export default router;
