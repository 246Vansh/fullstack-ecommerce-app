import { ApiError } from "../utils/ApiError.js";
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    getTokenMaxAge,
} from "../utils/jwt.js";
import {
    registerUser,
    loginUser,
    getUserById,
} from "../services/authService.js";

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

// remember=false gives a session cookie that ends when the browser closes.
function setRefreshCookie(res, user, remember) {
    const token = signRefreshToken(user);

    res.cookie(REFRESH_COOKIE, token, {
        ...cookieOptions(),
        ...(remember && { maxAge: getTokenMaxAge(token) }),
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

    setRefreshCookie(res, user, Boolean(remember));

    res.json({
        success: true,
        user,
        accessToken: signAccessToken(user),
    });
}

// Exchanges the refresh cookie for a new access token (used on page load).
export async function refresh(req, res) {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (!token) {
        throw new ApiError(401, "No active session");
    }

    let payload;

    try {
        payload = verifyRefreshToken(token);
    } catch {
        res.clearCookie(REFRESH_COOKIE, cookieOptions());
        throw new ApiError(401, "Session expired");
    }

    const user = await getUserById(Number(payload.sub));

    res.json({
        success: true,
        user,
        accessToken: signAccessToken(user),
    });
}

export function logout(req, res) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());

    res.json({ success: true });
}

export async function me(req, res) {
    const user = await getUserById(req.user.id);

    res.json({ success: true, user });
}
