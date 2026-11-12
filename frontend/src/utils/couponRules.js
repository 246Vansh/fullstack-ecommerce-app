// Coupon helpers shared by checkout and the admin coupon pages: the admin
// form's client-side checks (the server repeats every one of them), its
// request body, and how a coupon's terms read. No discount is ever computed
// here; amounts shown at checkout come from the server.
import { formatPrice } from "./money.js";

export const COUPON_CURRENCIES = ["USD", "INR"];

// Same shape the server accepts: 3-40 letters, digits, '-' or '_'.
const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const MAX_USES = 1_000_000_000;

export const normalizeCouponCode = (value) => String(value ?? "").trim().toUpperCase();

// "15% off", "15% off (up to ₹500.00)", "₹200.00 off".
export function couponTerms(coupon) {
    if (!coupon) return "";

    if (coupon.discountType === "PERCENTAGE") {
        const percent = `${Number(coupon.discountValue)}% off`;
        return coupon.maximumDiscountAmount != null
            ? `${percent} (up to ${formatPrice(coupon.maximumDiscountAmount, coupon.currency)})`
            : percent;
    }

    return `${formatPrice(coupon.discountValue, coupon.currency)} off`;
}

// Admin list wording and badge tone for the server's derived status.
export const COUPON_STATUS = {
    ACTIVE: { label: "Active", tone: "success" },
    SCHEDULED: { label: "Scheduled", tone: "info" },
    EXPIRED: { label: "Expired", tone: "warning" },
    USED_UP: { label: "Used up", tone: "warning" },
    INACTIVE: { label: "Inactive", tone: "neutral" },
};

// "3 / 100 used", "3 used" (no limit).
export const usageText = (coupon) => (coupon.usageLimit == null
    ? `${coupon.usedCount} used`
    : `${coupon.usedCount} / ${coupon.usageLimit} used`);

// ------------------------------------------------------------ dates

// <input type="datetime-local"> works in the browser's local time without a
// zone; the API takes and returns ISO 8601 instants.
const pad = (n) => String(n).padStart(2, "0");

export function toLocalInput(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ------------------------------------------------------------ admin form

export const emptyCouponForm = () => ({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    currency: "INR",
    minimumOrderAmount: "",
    maximumDiscountAmount: "",
    usageLimit: "",
    usageLimitPerUser: "",
    startsAt: "",
    expiresAt: "",
    isActive: true,
});

const text = (value) => (value == null ? "" : String(value));

export const couponFormFrom = (coupon) => ({
    code: coupon.code,
    description: text(coupon.description),
    discountType: coupon.discountType,
    discountValue: text(coupon.discountValue),
    currency: coupon.currency,
    minimumOrderAmount: coupon.minimumOrderAmount ? text(coupon.minimumOrderAmount) : "",
    maximumDiscountAmount: text(coupon.maximumDiscountAmount),
    usageLimit: text(coupon.usageLimit),
    usageLimitPerUser: text(coupon.usageLimitPerUser),
    startsAt: toLocalInput(coupon.startsAt),
    expiresAt: toLocalInput(coupon.expiresAt),
    isActive: coupon.isActive,
});

const trimmed = (value) => String(value ?? "").trim();

function amountError(value, { label, required = false, zero = false }) {
    const amount = trimmed(value);
    if (!amount) return required ? `${label} is required` : "";
    if (!MONEY.test(amount)) return `${label} must be an amount with at most 2 decimals`;
    if (!zero && !(Number(amount) > 0)) return `${label} must be more than 0`;
    return "";
}

function countError(value, label) {
    const count = trimmed(value);
    if (!count) return "";
    if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > MAX_USES) return `${label} must be a whole number of at least 1`;
    return "";
}

// Field messages keyed like the API's fields ("" = fine).
export function couponErrors(form) {
    const errors = {
        code: COUPON_CODE.test(normalizeCouponCode(form.code)) ? "" : "Use 3-40 letters, numbers, '-' or '_'",
        description: trimmed(form.description).length > 255 ? "Description must be at most 255 characters" : "",
        discountValue: amountError(form.discountValue, { label: "Discount", required: true }),
        minimumOrderAmount: amountError(form.minimumOrderAmount, { label: "Minimum order", zero: true }),
        maximumDiscountAmount: form.discountType === "PERCENTAGE"
            ? amountError(form.maximumDiscountAmount, { label: "Maximum discount" })
            : "",
        usageLimit: countError(form.usageLimit, "Total uses"),
        usageLimitPerUser: countError(form.usageLimitPerUser, "Uses per customer"),
        startsAt: "",
        expiresAt: "",
    };

    if (!errors.discountValue && form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100) {
        errors.discountValue = "A percentage cannot be more than 100";
    }

    if (!errors.usageLimit && !errors.usageLimitPerUser && trimmed(form.usageLimit) && trimmed(form.usageLimitPerUser)
        && Number(form.usageLimitPerUser) > Number(form.usageLimit)) {
        errors.usageLimitPerUser = "Cannot be more than the total uses";
    }

    const starts = fromLocalInput(form.startsAt);
    const expires = fromLocalInput(form.expiresAt);
    if (expires && new Date(expires).getTime() <= new Date(starts ?? Date.now()).getTime()) {
        errors.expiresAt = "Must be after the start";
    }

    return errors;
}

const orNull = (value) => (trimmed(value) ? trimmed(value) : null);
const countOrNull = (value) => (trimmed(value) ? Number(trimmed(value)) : null);

// The request body. Empty optional fields are sent as null (clearing them).
// The start cannot be cleared: left empty it is not sent (on create the
// server starts the coupon now; on edit it stays as it was).
export function couponPayload(form) {
    const payload = {
        code: normalizeCouponCode(form.code),
        description: orNull(form.description),
        discountType: form.discountType,
        discountValue: trimmed(form.discountValue),
        currency: form.currency,
        minimumOrderAmount: trimmed(form.minimumOrderAmount) || "0",
        maximumDiscountAmount: form.discountType === "PERCENTAGE" ? orNull(form.maximumDiscountAmount) : null,
        usageLimit: countOrNull(form.usageLimit),
        usageLimitPerUser: countOrNull(form.usageLimitPerUser),
        expiresAt: fromLocalInput(form.expiresAt),
        isActive: Boolean(form.isActive),
    };

    const startsAt = fromLocalInput(form.startsAt);
    if (startsAt) payload.startsAt = startsAt;

    return payload;
}
