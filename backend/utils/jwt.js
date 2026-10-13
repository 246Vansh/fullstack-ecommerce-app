import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

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

export function signAccessToken(user) {
    return jwt.sign(
        { sub: String(user.id), role: user.role, type: "access" },
        getSecret("JWT_ACCESS_SECRET"),
        { expiresIn: ACCESS_EXPIRES_IN },
    );
}

// jti makes every token unique (it is stored hashed); fam is the login session.
export function signRefreshToken(user, familyId) {
    return jwt.sign(
        { sub: String(user.id), type: "refresh", fam: familyId, jti: crypto.randomUUID() },
        getSecret("JWT_REFRESH_SECRET"),
        { expiresIn: REFRESH_EXPIRES_IN },
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
