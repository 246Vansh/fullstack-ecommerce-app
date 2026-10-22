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

    return { token, persistent, familyId };
}

function revokeFamily(familyId, reason) {
    return prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
    });
}

// Revokes every active session of a user, except exceptFamilyId (the caller's
// own) when given. Pass db to run inside a transaction. A revoked token that
// is presented later is handled like any other non-ROTATED one (REUSE path).
export function revokeAllUserSessions(userId, { exceptFamilyId, reason = "LOGOUT", db = prisma } = {}) {
    return db.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...(exceptFamilyId && { familyId: { not: exceptFamilyId } }) },
        data: { revokedAt: new Date(), revokedReason: reason },
    });
}

// Starts a new login session. persistent = "remember me". verifiedPasswordHash
// is the hash the login's password was checked against: the session is only
// created while it is still the user's password.
export async function createSession(userId, persistent, { verifiedPasswordHash } = {}) {
    // Keep the table small: this user's expired tokens are no longer useful.
    await prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });

    return prisma.$transaction(async (tx) => {
        if (verifiedPasswordHash !== undefined) {
            // A password change updates this row before revoking sessions, so
            // the lock orders the two: a change that commits first makes this
            // login fail; one that comes later revokes the session made here.
            const [current] = await tx.$queryRaw`SELECT passwordHash FROM users WHERE id = ${userId} FOR UPDATE`;

            if (current?.passwordHash !== verifiedPasswordHash) {
                throw new ApiError(401, "Invalid email or password");
            }
        }

        return issue(tx, { userId, familyId: crypto.randomUUID(), persistent });
    });
}

// Exchanges a refresh token for a new one, revoking the old one.
// Returns { userId, token, persistent, familyId }; throws 401 for anything invalid.
export async function rotateSession(token) {
    let payload;

    try {
        payload = verifyRefreshToken(token);
    } catch {
        throw sessionExpired();
    }

    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw sessionExpired();

    const result = await prisma.$transaction(async (tx) => {
        const tokenHash = hashToken(token);

        // Locks the user row, then the token row, in the order a password
        // change and createSession take them: a refresh that locked its token
        // first would deadlock with a password change, since inserting the
        // new token checks the users foreign key. Both locks come before the
        // first plain read; the transaction's snapshot starts at that read, so
        // a logout, password change or other refresh that held either row
        // commits first and is seen below; one that comes later waits for this
        // transaction and then sees the token issued here.
        const [owner] = await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        if (!owner) return null;

        await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE tokenHash = ${tokenHash} FOR UPDATE`;

        const row = await tx.refreshToken.findUnique({ where: { tokenHash } });

        if (!row || row.userId !== userId || row.expiresAt <= new Date()) {
            return null;
        }

        if (row.revokedAt) {
            // The family's active tokens are read with a lock (the latest
            // committed rows, not the snapshot), so a family revoked while
            // this refresh waited has none and is not continued.
            const recentlyRotated = row.revokedReason === "ROTATED"
                && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS
                && (await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE familyId = ${row.familyId} AND revokedAt IS NULL FOR UPDATE`).length > 0;

            if (!recentlyRotated) return { reuse: row };
        } else {
            // The row is locked, so this always revokes it. If it did not, the
            // token was revoked by someone else: never issue a new one then.
            const { count } = await tx.refreshToken.updateMany({
                where: { id: row.id, revokedAt: null },
                data: { revokedAt: new Date(), revokedReason: "ROTATED" },
            });

            if (count !== 1) return null;
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
