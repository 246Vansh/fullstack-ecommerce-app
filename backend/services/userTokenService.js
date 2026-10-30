import crypto from "node:crypto";

import prisma from "../config/db.js";

// Single-use emailed tokens (password reset, email verification). The token
// is 32 random bytes; only its SHA-256 hash is stored.
const LIFETIME_MS = {
    PASSWORD_RESET: 30 * 60 * 1000,
    EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
};

// How long a token of this purpose stays valid, for the wording of its email.
export const tokenLifetimeMs = (purpose) => LIFETIME_MS[purpose];

// A new token for the same purpose is not sent sooner than this after the
// last one, so the endpoints cannot be used to flood someone's inbox.
const RESEND_INTERVAL_MS = 60 * 1000;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Returns a new token, or null when one was issued less than a minute ago.
// Older unused tokens of this purpose are marked used, so only the latest
// link works; with { replaceOlder: false } they are left for the caller to
// retire with replaceOlderUserTokens() once the new link has been delivered.
// The user row is locked first, the order every other account-changing
// transaction (refreshTokenService, accountService) uses.
export function issueUserToken(userId, purpose, { replaceOlder = true } = {}) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

        const recent = await tx.userToken.findFirst({
            where: { userId, purpose, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
            select: { id: true },
        });

        if (recent) return null;

        if (replaceOlder) {
            await tx.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
        }

        const token = crypto.randomBytes(32).toString("base64url");

        await tx.userToken.create({
            data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]) },
        });

        return token;
    });
}

// Marks the unused tokens issued before this one (same user and purpose) as
// used, so only the latest link works. Only older rows: a newer link is never
// retired by a slow delivery of this one. Does nothing if the token is gone.
export function replaceOlderUserTokens(token) {
    return prisma.$transaction(async (tx) => {
        const issued = await tx.userToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true, purpose: true } });
        if (!issued) return;

        await tx.$queryRaw`SELECT id FROM users WHERE id = ${issued.userId} FOR UPDATE`;
        await tx.userToken.updateMany({
            where: { userId: issued.userId, purpose: issued.purpose, usedAt: null, id: { lt: issued.id } },
            data: { usedAt: new Date() },
        });
    });
}

// Removes a token whose email could not be delivered, so the resend cooldown
// above does not hold back a retry for a link nobody received. Older links
// are still valid (issued with replaceOlder: false), so the user keeps one.
export async function discardUserToken(token) {
    await prisma.userToken.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// Inside tx: marks the token used and returns its userId, or null when it is
// unknown, for another purpose, expired or already used. The rows are locked
// (user, then token), so two requests with the same token cannot both succeed.
export async function consumeUserToken(tx, token, purpose) {
    if (typeof token !== "string" || !token) return null;

    const tokenHash = hashToken(token);

    // Plain read to learn which user row to lock first.
    const found = await prisma.userToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!found) return null;

    await tx.$queryRaw`SELECT id FROM users WHERE id = ${found.userId} FOR UPDATE`;
    const [row] = await tx.$queryRaw`SELECT id, userId, purpose, expiresAt, usedAt FROM user_tokens WHERE tokenHash = ${tokenHash} FOR UPDATE`;

    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= new Date()) return null;

    await tx.userToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });

    return row.userId;
}
