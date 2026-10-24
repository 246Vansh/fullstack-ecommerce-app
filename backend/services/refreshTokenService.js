import crypto from "node:crypto";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { signRefreshToken, verifyRefreshToken, getTokenMaxAge, sessionLifetimeMs } from "../utils/jwt.js";

// A token rotated this recently may be presented again (two tabs refreshing
// at once, or a refresh response lost before its cookie was stored); it gets
// a new token in the same family instead of being treated as stolen.
const REUSE_GRACE_MS = 10 * 1000;

// A session this close to its absolute expiry is not refreshed: the new
// token would expire (whole-second JWT exp) as soon as it was issued.
const MIN_SESSION_REMAINING_MS = 1000;

const sessionExpired = () => new ApiError(401, "Session expired");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// sessionExpiresAt is set once, at login, and copied to every token of the
// session; each token expires at the earlier of it and its own inactivity limit.
async function issue(db, { userId, familyId, persistent, sessionExpiresAt }) {
    const token = signRefreshToken({ id: userId }, familyId, sessionExpiresAt);

    await db.refreshToken.create({
        data: {
            userId,
            familyId,
            persistent,
            sessionExpiresAt,
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

        return issue(tx, {
            userId,
            familyId: crypto.randomUUID(),
            persistent,
            sessionExpiresAt: new Date(Date.now() + sessionLifetimeMs()),
        });
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

        // Checked before the revoked/grace branches, so no path issues a token
        // for a session past (or within a second of) its absolute expiry.
        if (!row || row.userId !== userId || row.expiresAt <= new Date()
            || row.sessionExpiresAt.getTime() - Date.now() < MIN_SESSION_REMAINING_MS) {
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

// Logout everywhere, from the refresh cookie: revokes every session of the
// token's user. Only a token that could still refresh counts; an expired,
// revoked or unknown one is ignored (a stale stolen token cannot sign the
// owner out of everything), and the call still succeeds.
export async function revokeAllSessionsForToken(token) {
    const row = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { userId: true, revokedAt: true, expiresAt: true },
    });

    if (row && !row.revokedAt && row.expiresAt > new Date()) await revokeAllUserSessions(row.userId);
}

// The user's signed-in sessions (refresh-token families with a usable token),
// newest activity first. id is the familyId (the access token's sid), so the
// caller's own session is marked current. No device details are stored.
export async function listUserSessions(userId, currentSessionId) {
    const active = await prisma.refreshToken.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { familyId: true, persistent: true, createdAt: true, expiresAt: true, sessionExpiresAt: true },
        orderBy: { createdAt: "desc" },
    });

    // Two tokens of one family can be active for a moment (reuse grace window).
    const latest = new Map();
    for (const row of active) if (!latest.has(row.familyId)) latest.set(row.familyId, row);

    const started = await prisma.refreshToken.groupBy({
        by: ["familyId"],
        where: { userId, familyId: { in: [...latest.keys()] } },
        _min: { createdAt: true },
    });
    const signedInAt = new Map(started.map((row) => [row.familyId, row._min.createdAt]));

    return [...latest.values()].map((row) => ({
        id: row.familyId,
        current: row.familyId === currentSessionId,
        persistent: row.persistent,
        signedInAt: signedInAt.get(row.familyId),
        lastActiveAt: row.createdAt,
        expiresAt: row.expiresAt,
        sessionExpiresAt: row.sessionExpiresAt,
    }));
}

// Signs out one of the user's own sessions. A session of another user, or
// one already ended, is "not found", so ids of other users' sessions are
// indistinguishable from made-up ones.
export async function revokeUserSession(userId, sessionId) {
    const { count } = await prisma.refreshToken.updateMany({
        where: { userId, familyId: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "LOGOUT" },
    });

    if (count === 0) throw new ApiError(404, "Session not found");
}
