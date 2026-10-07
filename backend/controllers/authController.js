import { ApiError } from "../utils/ApiError.js";
import { signAccessToken, getTokenMaxAge } from "../utils/jwt.js";
import {
    registerUser,
    loginUser,
    getUserById,
} from "../services/authService.js";
import { createSession, rotateSession, revokeSession } from "../services/refreshTokenService.js";

const REFRESH_COOKIE = "refreshToken";

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE
            ? process.env.COOKIE_SECURE === "true"
            : process.env.NODE_ENV === "production",
        sameSite: process.env.COOKIE_SAME_SITE || "lax",
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: "/api/auth",
    };
}

// persistent=false gives a session cookie that ends when the browser closes.
function setRefreshCookie(res, { token, persistent }) {
    res.cookie(REFRESH_COOKIE, token, {
        ...cookieOptions(),
        ...(persistent && { maxAge: getTokenMaxAge(token) }),
    });
}

export async function register(req, res) {
    const { firstName, lastName, email, password } = req.body;

    const user = await registerUser({ firstName, lastName, email, password });

    res.status(201).json({ success: true, user });
}

export async function login(req, res) {
    const { email, password, remember } = req.body;

    const user = await loginUser({ email, password });

    setRefreshCookie(res, await createSession(user.id, Boolean(remember)));

    res.json({
        success: true,
        user,
        accessToken: signAccessToken(user),
    });
}

// Exchanges the refresh cookie for a new access token (used on page load).
// The refresh token is rotated: the old one is revoked and a new one is set.
export async function refresh(req, res) {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (!token) {
        throw new ApiError(401, "No active session");
    }

    let session;

    try {
        session = await rotateSession(token);
    } catch (error) {
        if (error.statusCode === 401) res.clearCookie(REFRESH_COOKIE, cookieOptions());
        throw error;
    }

    const user = await getUserById(session.userId);

    setRefreshCookie(res, session);

    res.json({
        success: true,
        user,
        accessToken: signAccessToken(user),
    });
}

// Revokes the whole login session server-side, not just the cookie.
export async function logout(req, res) {
    const token = req.cookies?.[REFRESH_COOKIE];

    res.clearCookie(REFRESH_COOKIE, cookieOptions());

    if (token) await revokeSession(token);

    res.json({ success: true });
}

export async function me(req, res) {
    const user = await getUserById(req.user.id);

    res.json({ success: true, user });
}
