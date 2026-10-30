import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { issueUserToken, consumeUserToken, discardUserToken, replaceOlderUserTokens, tokenLifetimeMs } from "./userTokenService.js";
import { revokeAllUserSessions } from "./refreshTokenService.js";
import { sendMail, appLink } from "./mailService.js";
import { verificationEmail } from "./mailTemplates.js";

export const SALT_ROUNDS = 12;

// Compared against when the email is unknown, so both failure paths do the
// same bcrypt work and response time does not reveal which emails exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), SALT_ROUNDS);

// Fields that are safe to send to the client. Never includes passwordHash.
export const safeUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    emailVerifiedAt: true,
    createdAt: true,
};

export async function registerUser({ firstName, lastName, email, password }) {
    const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existing) {
        throw new ApiError(409, "An account with this email already exists", [
            { field: "email", message: "An account with this email already exists" },
        ]);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        return await prisma.user.create({
            data: { firstName, lastName, email, passwordHash, role: "CUSTOMER" },
            select: safeUserSelect,
        });
    } catch (error) {
        // Unique constraint hit by a concurrent registration.
        if (error.code === "P2002") {
            throw new ApiError(409, "An account with this email already exists", [
                { field: "email", message: "An account with this email already exists" },
            ]);
        }

        throw error;
    }
}

export async function loginUser({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
        throw new ApiError(401, "Invalid email or password");
    }

    const { passwordHash, ...safeUser } = user;

    // passwordHash is for createSession's check only; it is never sent.
    return { user: safeUser, passwordHash };
}

export async function getUserById(id) {
    const user = await prisma.user.findUnique({
        where: { id },
        select: safeUserSelect,
    });

    if (!user) {
        throw new ApiError(401, "User no longer exists");
    }

    return user;
}

// Emails a verification link unless the address is already verified (or a
// link was sent in the last minute). Returns whether one was sent, and
// rejects with 503 when the mail provider did not accept it; callers that do
// not need the answer do not await it. Earlier links keep working until the
// new one has been delivered, so a failed send never leaves the user without one.
export async function sendVerificationEmail(user) {
    if (user.emailVerifiedAt) return false;

    const token = await issueUserToken(user.id, "EMAIL_VERIFICATION", { replaceOlder: false });
    if (!token) return false;

    const delivered = await sendMail({
        to: user.email,
        ...verificationEmail({
            firstName: user.firstName,
            link: appLink("/verify-email", token),
            lifetimeMs: tokenLifetimeMs("EMAIL_VERIFICATION"),
        }),
    }, "verification");

    if (!delivered) {
        await discardUserToken(token);
        throw new ApiError(503, "We could not send the verification email right now. Please try again in a few minutes.");
    }

    await replaceOlderUserTokens(token);

    return true;
}

// Always resolves the same way whether or not the email belongs to an
// account, so the response never reveals which emails are registered.
export async function requestPasswordReset(email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true } });
    if (!user) return;

    const token = await issueUserToken(user.id, "PASSWORD_RESET");
    if (!token) return;

    sendMail({
        to: user.email,
        subject: "Reset your password",
        text: `Hi ${user.firstName},

Reset your password by opening this link (valid for 30 minutes, single use):
${appLink("/reset-password", token)}

If you did not ask for this, ignore this email; your password is unchanged.`,
    }, "password reset");
}

const invalidLink = (field = "token") => new ApiError(400, "This link is invalid or has expired. Please request a new one.", [
    { field, message: "This link is invalid or has expired. Please request a new one." },
]);

// Sets a new password from an emailed token and signs out every session. The
// link proves control of the mailbox, so the email also counts as verified.
export async function resetPassword({ token, password }) {
    // Hashed before the transaction, so no row lock is held during bcrypt.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const reset = await prisma.$transaction(async (tx) => {
        const userId = await consumeUserToken(tx, token, "PASSWORD_RESET");
        if (!userId) return false;

        const now = new Date();

        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
        await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
        await revokeAllUserSessions(userId, { db: tx });

        return true;
    });

    if (!reset) throw invalidLink();
}

export async function verifyEmail(token) {
    const verified = await prisma.$transaction(async (tx) => {
        const userId = await consumeUserToken(tx, token, "EMAIL_VERIFICATION");
        if (!userId) return false;

        await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });

        return true;
    });

    if (!verified) throw invalidLink();
}
