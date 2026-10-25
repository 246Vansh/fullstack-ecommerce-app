import { tokenLifetimeSeconds } from "../utils/jwt.js";

// RESERVATION_CREATED_CUTOFF: how long past its reservation deadline an online
// order may keep its stock while its only open Razorpay payments are
// "created" (the customer started paying, e.g. a UPI request, but nothing has
// been authorized). After that the expiry worker expires it; a payment
// captured later is handled as a late payment. A duration with a unit, as for
// the JWT lifetimes ("90m", "2h"), from 1 minute to 24 hours. Unset or blank:
// DEFAULT_CREATED_CUTOFF.
export const DEFAULT_CREATED_CUTOFF = "2h";
export const MIN_CREATED_CUTOFF_MS = 60 * 1000;
export const MAX_CREATED_CUTOFF_MS = 24 * 60 * 60 * 1000;

// Milliseconds, or null when the value is not an allowed duration.
export function createdCutoffMs(value) {
    const raw = String(value ?? "").trim() || DEFAULT_CREATED_CUTOFF;

    // A bare number has no unit (jsonwebtoken would read it as milliseconds).
    if (/^-?[\d.]+$/.test(raw)) return null;

    const seconds = tokenLifetimeSeconds(raw);
    if (seconds == null) return null;

    const ms = seconds * 1000;
    return ms >= MIN_CREATED_CUTOFF_MS && ms <= MAX_CREATED_CUTOFF_MS ? ms : null;
}
