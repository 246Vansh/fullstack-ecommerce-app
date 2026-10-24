import crypto from "node:crypto";

import prisma from "../config/db.js";

// Single-use emailed tokens (password reset, email verification). The token
// is 32 random bytes; only its SHA-256 hash is stored.
const LIFETIME_MS = {
    PASSWORD_RESET: 30 * 60 * 1000,
    EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
};

// A new token for the same purpose is not sent sooner than this after the
// last one, so the endpoints cannot be used to flood someone's inbox.
const RESEND_INTERVAL_MS = 60 * 1000;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Returns a new token, or null when one was issued less than a minute ago.
// Older unused tokens of this purpose are marked used, so only the latest
// link works. The user row is locked first, the order every other
// account-changing transaction (refreshTokenService, accountService) uses.
export function issueUserToken(userId, purpose) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

        const recent = await tx.userToken.findFirst({
            where: { userId, purpose, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
            select: { id: true },
        });

        if (recent) return null;

        await tx.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });

        const token = crypto.randomBytes(32).toString("base64url");

        await tx.userToken.create({
            data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]) },
        });

        return token;
    });
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
