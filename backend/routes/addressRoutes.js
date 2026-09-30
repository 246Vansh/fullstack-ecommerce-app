import { Router } from "express";
import { body, param } from "express-validator";

import {
    getMyAddresses,
    getMyAddress,
    createMyAddress,
    updateMyAddress,
    deleteMyAddress,
} from "../controllers/addressController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const ADDRESS_TYPES = ["HOME", "WORK", "OTHER"];

// Lengths match the Address columns in schema.prisma.
const text = (field, label, max) => body(field)
    .isString().withMessage(`${label} is required`)
    .trim()
    .notEmpty().withMessage(`${label} is required`)
    .isLength({ max }).withMessage(`${label} must be at most ${max} characters`);

// `required` is false for PATCH, where every field is optional.
function addressRules(required) {
    const need = (chain) => (required ? chain : chain.optional());

    return [
        body("type").optional().isIn(ADDRESS_TYPES).withMessage(`type must be one of: ${ADDRESS_TYPES.join(", ")}`),
        need(text("firstName", "First name", 100)),
        need(text("lastName", "Last name", 100)),
        need(text("phone", "Phone", 30)
            .matches(/^\+?[0-9\s().-]{7,30}$/).withMessage("Enter a valid phone number")),
        need(text("address", "Address", 255)),
        // Optional everywhere; an empty value clears it (see addressService).
        body("apartment").optional()
            .isString().withMessage("Apartment must be text")
            .trim()
            .isLength({ max: 255 }).withMessage("Apartment must be at most 255 characters"),
        need(text("city", "City", 100)),
        need(text("state", "State", 100)),
        need(text("zipCode", "ZIP code", 20)
            .matches(/^[A-Za-z0-9][A-Za-z0-9\s-]*$/).withMessage("Enter a valid ZIP code")),
        need(text("country", "Country", 100)),
        body("isDefault").optional().isBoolean({ strict: true }).withMessage("isDefault must be true or false"),
    ];
}

const idRules = [
    param("id").isInt({ min: 1 }).withMessage("Address id must be a positive integer").toInt(),
];

const ADDRESS_FIELDS = ["type", "firstName", "lastName", "phone", "address", "apartment", "city", "state", "zipCode", "country", "isDefault"];

function requireSomeField(req, res, next) {
    if (!ADDRESS_FIELDS.some((field) => field in (req.body ?? {}))) {
        return next(new ApiError(422, "Provide at least one address field to update"));
    }

    next();
}

router.use(authenticate);

router.get("/", getMyAddresses);
router.get("/:id", idRules, validate, getMyAddress);
router.post("/", addressRules(true), validate, createMyAddress);
router.patch("/:id", idRules, requireSomeField, addressRules(false), validate, updateMyAddress);
router.delete("/:id", idRules, validate, deleteMyAddress);

export default router;
