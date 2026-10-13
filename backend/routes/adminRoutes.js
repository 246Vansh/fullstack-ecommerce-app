import { Router } from "express";
import { body, param, query, matchedData } from "express-validator";

import {
    listProducts, getProduct, createProduct, updateProduct, deactivateProduct, replaceImages,
    createVariant, updateVariant, deactivateVariant,
    listCategories, createCategory, updateCategory,
} from "../controllers/adminCatalogController.js";
import { ADMIN_PAGINATION, MAX_STOCK } from "../services/adminCatalogService.js";
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

const createProductRules = [
    ...productFields({ required: true }),
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

// ------------------------------------------------------------ routes

router.get("/products", listRules, validate, listProducts);
router.post("/products", createProductRules, validate, createProduct);
router.get("/products/:id", idParam, validate, getProduct);
router.patch("/products/:id", idParam, productFields({ required: false }), validate, requireChanges, updateProduct);
// Soft delete (isActive = false); products are never removed from order history.
router.delete("/products/:id", idParam, validate, deactivateProduct);
router.put("/products/:id/images", idParam, imagesArray(true), imageFields("images.*."), validate, replaceImages);

router.post("/products/:id/variants", idParam, variantFields("", { required: true }), validate, createVariant);
router.patch("/variants/:id", updateVariantRules, validate, requireChanges, updateVariant);
router.delete("/variants/:id", idParam, validate, deactivateVariant);

router.get("/categories", listCategories);
router.post("/categories", categoryFields({ required: true }), validate, createCategory);
router.patch("/categories/:id", idParam, categoryFields({ required: false }), validate, requireChanges, updateCategory);

export default router;
