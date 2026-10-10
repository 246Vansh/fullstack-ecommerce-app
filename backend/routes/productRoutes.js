import { Router } from "express";
import { query, param } from "express-validator";

import { getProducts, getProduct, getProductsBatch } from "../controllers/productController.js";
import { PAGINATION, SORT_VALUES } from "../services/productService.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Accepts "a,b" or repeated params (?brand=a&brand=b); always yields a trimmed array.
const toList = (value) => (Array.isArray(value) ? value : String(value).split(","))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20);

const listParam = (name) => query(name).default([]).customSanitizer(toList);

const listRules = [
    query("search").optional().isString().trim().isLength({ max: 100 })
        .withMessage("Search must be at most 100 characters"),
    listParam("category"),
    listParam("subcategory"),
    listParam("brand"),
    listParam("color"),
    listParam("size"),
    query("minPrice").optional().isFloat({ min: 0 }).withMessage("minPrice must be a positive number").toFloat(),
    query("maxPrice").optional().isFloat({ min: 0 }).withMessage("maxPrice must be a positive number").toFloat(),
    query("inStock").optional().isBoolean().withMessage("inStock must be true or false").toBoolean(true),
    query("sort").default("newest").isIn(SORT_VALUES)
        .withMessage(`sort must be one of: ${SORT_VALUES.join(", ")}`),
    query("page").default(1).isInt({ min: 1 }).withMessage("page must be 1 or more").toInt(),
    query("limit").default(PAGINATION.defaultLimit)
        .isInt({ min: 1, max: PAGINATION.maxLimit })
        .withMessage(`limit must be between 1 and ${PAGINATION.maxLimit}`).toInt(),
];

const MAX_ID = 2147483647; // INT column

// ?ids=1,2,3 (or repeated ids=): positive integers, deduplicated.
const batchRules = [
    query("ids")
        .customSanitizer((value) => [value ?? []].flat().flatMap((item) => String(item).split(",")))
        .custom((ids) => ids.length > 0 && ids.every((id) => /^[1-9]\d{0,9}$/.test(id.trim()) && Number(id) <= MAX_ID))
        .withMessage("ids must be a comma-separated list of product ids")
        .customSanitizer((ids) => [...new Set(ids.map(Number))])
        .custom((ids) => ids.length <= PAGINATION.maxLimit)
        .withMessage(`ids can list at most ${PAGINATION.maxLimit} products`),
];

const idRules = [
    param("id").isInt({ min: 1 }).withMessage("Product id must be a positive integer").toInt(),
];

router.get("/", listRules, validate, getProducts);
// Before /:id, which would otherwise match "batch".
router.get("/batch", batchRules, validate, getProductsBatch);
router.get("/:id", idRules, validate, getProduct);

export default router;
