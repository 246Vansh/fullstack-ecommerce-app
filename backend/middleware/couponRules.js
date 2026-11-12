import { body, query } from "express-validator";

import { COUPON_CODE, normalizeCode } from "../services/couponService.js";

const MESSAGE = "couponCode must be 3-40 letters, numbers, '-' or '_'";

// A coupon code from a customer: trimmed and upper-cased, then checked for
// shape only (whether it exists and applies is decided by couponService).
const rule = (chain, { required }) => (required
    ? chain.exists({ values: "falsy" }).withMessage("couponCode is required").bail()
    : chain.optional({ values: "falsy" }))
    .isString().withMessage(MESSAGE).bail()
    .customSanitizer(normalizeCode)
    .matches(COUPON_CODE).withMessage(MESSAGE);

export const couponCodeBody = ({ required = false } = {}) => rule(body("couponCode"), { required });

export const couponCodeQuery = () => rule(query("couponCode").not().isArray().withMessage("couponCode must be given once").bail(), { required: false });
