import crypto from "node:crypto";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { signRefreshToken, verifyRefreshToken, getTokenMaxAge } from "../utils/jwt.js";

// A token rotated this recently may be presented again (two tabs refreshing
// at once, or a refresh response lost before its cookie was stored); it gets
// a new token in the same family instead of being treated as stolen.
const REUSE_GRACE_MS = 10 * 1000;

const sessionExpired = () => new ApiError(401, "Session expired");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function issue(db, { userId, familyId, persistent }) {
    const token = signRefreshToken({ id: userId }, familyId);

    await db.refreshToken.create({
        data: {
            userId,
            familyId,
            persistent,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + getTokenMaxAge(token)),
        },
    });

    return { token, persistent };
}

function revokeFamily(familyId, reason) {
    return prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
    });
}

// Starts a new login session. persistent = "remember me".
export async function createSession(userId, persistent) {
    // Keep the table small: this user's expired tokens are no longer useful.
    await prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });

    return issue(prisma, { userId, familyId: crypto.randomUUID(), persistent });
}

// Exchanges a refresh token for a new one, revoking the old one.
// Returns { userId, token, persistent }; throws 401 for anything invalid.
export async function rotateSession(token) {
    let payload;

    try {
        payload = verifyRefreshToken(token);
    } catch {
        throw sessionExpired();
    }

    const result = await prisma.$transaction(async (tx) => {
        const row = await tx.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });

        if (!row || row.userId !== Number(payload.sub) || row.expiresAt <= new Date()) {
            return null;
        }

        if (row.revokedAt) {
            const recentlyRotated = row.revokedReason === "ROTATED"
                && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS
                && await tx.refreshToken.count({ where: { familyId: row.familyId, revokedAt: null } }) > 0;

            if (!recentlyRotated) return { reuse: row };
        } else {
            // A concurrent refresh may rotate it first (count 0); that is
            // also a just-rotated token, so it falls through to a new token.
            await tx.refreshToken.updateMany({
                where: { id: row.id, revokedAt: null },
                data: { revokedAt: new Date(), revokedReason: "ROTATED" },
            });
        }

        return { userId: row.userId, ...await issue(tx, row) };
    });

    if (!result) throw sessionExpired();

    // Revoked outside the transaction so the 401 does not roll it back.
    if (result.reuse) {
        const { userId, familyId } = result.reuse;

        await revokeFamily(familyId, "REUSE");
        console.warn(`Refresh token reuse detected: user ${userId}, session ${familyId} revoked`);

        throw sessionExpired();
    }

    return result;
}

// Logout: revokes every token of the session this token belongs to.
// Expired or unknown tokens are ignored; logout always succeeds.
export async function revokeSession(token) {
    const row = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { familyId: true },
    });

    if (row) await revokeFamily(row.familyId, "LOGOUT");
}
