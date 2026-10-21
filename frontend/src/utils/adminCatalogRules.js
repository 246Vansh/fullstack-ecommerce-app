// Client-side copy of the /api/admin validation rules (backend/routes/
// adminRoutes.js and services/adminCatalogService.js). It only saves a round
// trip: the server validates everything again and its answer wins.
//
// Forms hold strings exactly as typed; the *Payload helpers turn them into
// the request body (trimmed, blank optional fields -> null, numbers parsed).

export const LIMITS = {
    productName: 200,
    productSlug: 220,
    brand: 100,
    text: 5000,
    sku: 100,
    size: 20,
    color: 50,
    url: 500,
    altText: 200,
    categoryName: 100,
    categorySlug: 120,
    images: 20,
    variants: 100,
    maxStock: 1_000_000,
};

// A product's prices are in one of these, chosen on create and fixed after.
export const CURRENCIES = ["USD", "INR"];

// Decimal(10, 2): up to 8 integer digits and 2 decimals.
const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9][A-Z0-9._-]*$/;
const HEX = /^#[0-9A-F]{6}$/;
const WHOLE = /^-?\d+$/;

const clean = (value) => String(value ?? "").trim();
const orNull = (value) => clean(value) || null;

// Whole cents, so "19.9" and "19.90" compare equal without float error.
export const toCents = (value) => Math.round(Number(value) * 100);

// Same rule as prisma/seed.js and the server, for the slug preview.
export const slugify = (value) =>
    String(value).toLowerCase().replace(/&/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ------------------------------------------------------------ field checks
// Each returns an error message, or "" when the value is acceptable.

function text(value, { label, max, required = false }) {
    const length = clean(value).length;

    if (required && !length) return `${label} is required`;
    if (length > max) return `${label} must be at most ${max} characters`;
    return "";
}

function money(value, { label, required = false }) {
    const amount = clean(value);

    if (!amount) return required ? `${label} is required` : "";
    if (!MONEY.test(amount) || !(Number(amount) > 0)) {
        return `${label} must be a positive amount with at most 2 decimals (max 99999999.99)`;
    }
    return "";
}

export function httpsUrlError(value, { label = "URL", required = false } = {}) {
    const url = clean(value);

    if (!url) return required ? `${label} is required` : "";
    if (url.length > LIMITS.url) return `${label} must be at most ${LIMITS.url} characters`;

    try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && parsed.hostname.includes(".")) return "";
    } catch {
        // falls through
    }
    return `${label} must be a full https:// address`;
}

function slug(value, { max, required = false }) {
    const normalized = clean(value).toLowerCase();

    if (!normalized) return required ? "Slug is required" : "";
    if (normalized.length > max || !SLUG.test(normalized)) {
        return `Slug must be lowercase letters, numbers and single hyphens (max ${max})`;
    }
    return "";
}

export function wholeNumberError(value, { label, min, max }) {
    const number = clean(value);

    if (!WHOLE.test(number)) return `${label} must be a whole number`;
    if (Number(number) < min || Number(number) > max) return `${label} must be between ${min} and ${max}`;
    return "";
}

// ------------------------------------------------------------ products

export const emptyProductForm = () => ({
    name: "", slug: "", brand: "", description: "",
    price: "", originalPrice: "", currency: "USD", categoryId: "", isNew: false, isActive: true,
});

export const productFormFrom = (product) => ({
    name: product.name,
    slug: product.slug,
    brand: product.brand ?? "",
    description: product.description ?? "",
    price: Number(product.price).toFixed(2),
    originalPrice: product.originalPrice == null ? "" : Number(product.originalPrice).toFixed(2),
    // Shown only: an existing product's currency cannot be changed.
    currency: product.currency,
    categoryId: String(product.category.id),
    isNew: product.isNew,
    isActive: product.isActive,
});

// Keys match the API's field names, so server errors land on the same fields.
export function productErrors(form, { slugRequired = false } = {}) {
    const errors = {
        name: text(form.name, { label: "Name", max: LIMITS.productName, required: true }),
        slug: slug(form.slug, { max: LIMITS.productSlug, required: slugRequired }),
        brand: text(form.brand, { label: "Brand", max: LIMITS.brand }),
        description: text(form.description, { label: "Description", max: LIMITS.text }),
        price: money(form.price, { label: "Price", required: true }),
        originalPrice: money(form.originalPrice, { label: "Compare-at price" }),
        categoryId: form.categoryId ? "" : "Choose a category",
    };

    if (!errors.price && !errors.originalPrice && clean(form.originalPrice)
        && toCents(form.originalPrice) <= toCents(form.price)) {
        errors.originalPrice = "Compare-at price must be greater than the price";
    }

    return errors;
}

export function productPayload(form, { create = false } = {}) {
    return {
        name: clean(form.name),
        // On create a blank slug lets the server generate one from brand + name.
        ...(clean(form.slug) || !create ? { slug: clean(form.slug).toLowerCase() } : {}),
        brand: orNull(form.brand),
        description: orNull(form.description),
        price: clean(form.price),
        originalPrice: orNull(form.originalPrice),
        categoryId: Number(form.categoryId),
        isNew: Boolean(form.isNew),
        // The currency is sent on create only; the server refuses it on update.
        ...(create && { isActive: Boolean(form.isActive), currency: form.currency }),
    };
}

// ------------------------------------------------------------ variants

export const emptyVariantForm = () => ({
    sku: "", size: "", color: "", colorHex: "", price: "", originalPrice: "", stock: "0",
});

export const variantFormFrom = (variant) => ({
    sku: variant.sku,
    size: variant.size ?? "",
    color: variant.color ?? "",
    colorHex: variant.colorHex ?? "",
    price: variant.price == null ? "" : Number(variant.price).toFixed(2),
    originalPrice: variant.originalPrice == null ? "" : Number(variant.originalPrice).toFixed(2),
});

// `product` gives the inherited prices ({ price, originalPrice } as typed or
// from the API). `withStock` for new variants, which set their initial stock.
export function variantErrors(form, product, { withStock = false } = {}) {
    const sku = clean(form.sku).toUpperCase();
    const hex = clean(form.colorHex).toUpperCase();

    const errors = {
        sku: !sku ? "SKU is required"
            : sku.length > LIMITS.sku || !SKU.test(sku) ? "SKU may use letters, numbers, '.', '_' and '-' (max 100)" : "",
        size: text(form.size, { label: "Size", max: LIMITS.size }),
        color: text(form.color, { label: "Color", max: LIMITS.color }),
        colorHex: hex && !HEX.test(hex) ? "Color code must look like #1A2B3C" : "",
        price: money(form.price, { label: "Price" }),
        originalPrice: money(form.originalPrice, { label: "Compare-at price" }),
        ...(withStock && { stock: wholeNumberError(form.stock, { label: "Stock", min: 0, max: LIMITS.maxStock }) }),
    };

    // The pair shoppers see: own price/was-price, else the product's.
    const price = clean(form.price) || clean(product?.price);
    const was = clean(form.originalPrice) || clean(product?.originalPrice);

    if (!errors.price && !errors.originalPrice && price && was && MONEY.test(price) && MONEY.test(was)
        && toCents(was) <= toCents(price)) {
        errors.originalPrice = clean(form.originalPrice)
            ? "Compare-at price must be greater than the price"
            : "The product's compare-at price would not be above this price; set a higher compare-at price here";
    }

    return errors;
}

export function variantPayload(form, { withStock = false } = {}) {
    return {
        sku: clean(form.sku).toUpperCase(),
        size: orNull(form.size),
        color: orNull(form.color),
        colorHex: orNull(form.colorHex)?.toUpperCase() ?? null,
        price: orNull(form.price),
        originalPrice: orNull(form.originalPrice),
        ...(withStock && { stock: Number(clean(form.stock)) }),
    };
}

// ------------------------------------------------------------ images

// `key` is a local id so Vue keeps each row's inputs (and focus) while reordering.
let imageKey = 0;
export const newImageForm = (url = "", altText = "") => ({ key: `image-${++imageKey}`, url, altText });

export const imageFormsFrom = (images) => images.map((image) => newImageForm(image.url, image.altText ?? ""));

export function imageErrors(images, prefix = "images") {
    const errors = {};

    images.forEach((image, index) => {
        errors[`${prefix}[${index}].url`] = httpsUrlError(image.url, { label: "Image URL", required: true });
        errors[`${prefix}[${index}].altText`] = text(image.altText, { label: "Alt text", max: LIMITS.altText });
    });

    return errors;
}

export const imagesPayload = (images) => images.map((image) => ({ url: clean(image.url), altText: orNull(image.altText) }));

// ------------------------------------------------------------ categories

export const emptyCategoryForm = () => ({ name: "", slug: "", description: "", image: "", parentId: "", isActive: true });

export const categoryFormFrom = (category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    image: category.image ?? "",
    parentId: category.parentId == null ? "" : String(category.parentId),
    isActive: category.isActive,
});

export function categoryErrors(form, { slugRequired = false } = {}) {
    return {
        name: text(form.name, { label: "Name", max: LIMITS.categoryName, required: true }),
        slug: slug(form.slug, { max: LIMITS.categorySlug, required: slugRequired }),
        description: text(form.description, { label: "Description", max: LIMITS.text }),
        image: httpsUrlError(form.image, { label: "Image URL" }),
    };
}

export function categoryPayload(form, { create = false } = {}) {
    return {
        name: clean(form.name),
        ...(clean(form.slug) || !create ? { slug: clean(form.slug).toLowerCase() } : {}),
        description: orNull(form.description),
        image: orNull(form.image),
        parentId: form.parentId ? Number(form.parentId) : null,
        isActive: Boolean(form.isActive),
    };
}

// ------------------------------------------------------------ helpers

export const hasErrors = (errors) => Object.values(errors).some(Boolean);

// The keys of `next` whose value differs from `original` (PATCH bodies).
export function changedFields(next, original) {
    return Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key])));
}
