import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// Blank or unset means these defaults (config/env.js validates the values).
export const DEFAULT_REFRESH_EXPIRES_IN = "7d";
export const DEFAULT_SESSION_ABSOLUTE_EXPIRES_IN = "30d";

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRES_IN;
// A login session ends this long after login however often it is refreshed;
// each refresh token also expires after JWT_REFRESH_EXPIRES_IN without use.
const SESSION_ABSOLUTE_EXPIRES_IN = process.env.SESSION_ABSOLUTE_EXPIRES_IN || DEFAULT_SESSION_ABSOLUTE_EXPIRES_IN;

// Seconds a token signed with this expiresIn string lives, as jsonwebtoken
// itself computes it, or null when jsonwebtoken rejects the value ("15x").
// Startup validation (config/env.js) uses this so it accepts exactly what
// signing will accept.
export function tokenLifetimeSeconds(expiresIn) {
    try {
        const { iat, exp } = jwt.decode(jwt.sign({}, "lifetime-check", { expiresIn }));
        return exp - iat;
    } catch {
        return null;
    }
}

function getSecret(name) {
    const secret = process.env[name];

    if (!secret) {
        throw new Error(`${name} is not set`);
    }

    return secret;
}

// Milliseconds from login until the session's absolute expiry.
export function sessionLifetimeMs() {
    return tokenLifetimeSeconds(SESSION_ABSOLUTE_EXPIRES_IN) * 1000;
}

// sid is the login session (refresh-token family) the token was issued for, so
// account routes outside /api/auth (which never see the refresh cookie) know
// which session is the caller's own. Its lifetime is not capped at the
// session's absolute expiry, so an access token issued just before it stays
// valid for up to JWT_ACCESS_EXPIRES_IN (15 minutes) afterwards.
export function signAccessToken(user, sessionId) {
    return jwt.sign(
        { sub: String(user.id), role: user.role, type: "access", ...(sessionId && { sid: sessionId }) },
        getSecret("JWT_ACCESS_SECRET"),
        { expiresIn: ACCESS_EXPIRES_IN },
    );
}

// jti makes every token unique (it is stored hashed); fam is the login session.
// Expires after REFRESH_EXPIRES_IN, but never after sessionExpiresAt (a Date).
export function signRefreshToken(user, familyId, sessionExpiresAt) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = Math.min(iat + tokenLifetimeSeconds(REFRESH_EXPIRES_IN), Math.floor(sessionExpiresAt.getTime() / 1000));

    return jwt.sign(
        { sub: String(user.id), type: "refresh", fam: familyId, jti: crypto.randomUUID(), iat, exp },
        getSecret("JWT_REFRESH_SECRET"),
    );
}

// Throws jsonwebtoken errors (expired, invalid) for the caller to handle.
export function verifyAccessToken(token) {
    const payload = jwt.verify(token, getSecret("JWT_ACCESS_SECRET"));

    if (payload.type !== "access") {
        throw new jwt.JsonWebTokenError("Invalid token type");
    }

    return payload;
}

export function verifyRefreshToken(token) {
    const payload = jwt.verify(token, getSecret("JWT_REFRESH_SECRET"));

    if (payload.type !== "refresh") {
        throw new jwt.JsonWebTokenError("Invalid token type");
    }

    return payload;
}

// Milliseconds until the token's exp claim.
export function getTokenMaxAge(token) {
    const { exp } = jwt.decode(token);

    return exp * 1000 - Date.now();
}
