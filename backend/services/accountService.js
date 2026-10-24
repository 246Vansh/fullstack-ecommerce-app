import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { SALT_ROUNDS, safeUserSelect, sendVerificationEmail } from "./authService.js";
import { revokeAllUserSessions } from "./refreshTokenService.js";

// The only User columns a profile update may write. role, email,
// emailVerifiedAt and passwordHash are never accepted here, even if a caller
// passes them.
const PROFILE_FIELDS = ["firstName", "lastName", "phone"];

const userGone = () => new ApiError(401, "User no longer exists");

export async function updateProfile(userId, input) {
    const data = Object.fromEntries(PROFILE_FIELDS.filter((field) => field in input).map((field) => [field, input[field]]));

    // An empty phone is stored as NULL (same reason as addressService's apartment).
    if ("phone" in data) data.phone = data.phone || null;

    try {
        return await prisma.user.update({ where: { id: userId }, data, select: safeUserSelect });
    } catch (error) {
        // Deleted after the access token was issued.
        if (error.code === "P2025") throw userGone();
        throw error;
    }
}

// Checks the current password, stores the new hash and signs out every other
// session; the caller's own session (sessionId) stays valid. Access tokens
// already issued to other sessions still work until they expire (15 minutes).
export async function changePassword(userId, { currentPassword, newPassword, sessionId }) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });

    if (!user) throw userGone();

    // 422, not 401: a 401 makes the client refresh and replay the attempt.
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
        throw new ApiError(422, "Current password is incorrect", [
            { field: "currentPassword", message: "Current password is incorrect" },
        ]);
    }

    if (newPassword === currentPassword) {
        throw new ApiError(422, "Choose a password different from your current one", [
            { field: "newPassword", message: "Choose a password different from your current one" },
        ]);
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
        // Only replaces the hash that was checked above, so of two concurrent
        // changes with the same current password, one wins and one fails.
        const { count } = await tx.user.updateMany({
            where: { id: userId, passwordHash: user.passwordHash },
            data: { passwordHash },
        });

        if (count === 0) {
            throw new ApiError(409, "Your password was just changed by another request. Please try again.");
        }

        await revokeAllUserSessions(userId, { exceptFamilyId: sessionId, db: tx });
    });
}

// Sends a new verification link to the signed-in user's email.
export async function resendVerification(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, emailVerifiedAt: true } });

    if (!user) throw userGone();

    if (user.emailVerifiedAt) {
        throw new ApiError(409, "Your email address is already verified");
    }

    // false = a link was sent less than a minute ago (e.g. at sign-up) and no
    // new one was issued. Saying so reveals nothing: this is the signed-in
    // user's own address, and the earlier link still works.
    if (!(await sendVerificationEmail(user))) {
        throw new ApiError(429, "A verification link was sent less than a minute ago. Check your inbox and spam folder, or try again in a minute.");
    }
}

// Deletes the account by removing its personal data, not the users row:
// orders must keep their user (onDelete: Restrict) and already carry their
// own shipping snapshot. Name, email, phone and password are replaced, so the
// row can never sign in again and the email can be registered anew; addresses,
// cart, sessions and emailed tokens are deleted. Reviews stay, shown under the
// replaced name. Requires the current password (reauthentication).
export async function deleteAccount(userId, { password }) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });

    if (!user) throw userGone();

    // An admin removing their own account could leave the shop without one.
    if (user.role === "ADMIN") {
        throw new ApiError(403, "Admin accounts cannot be deleted from account settings");
    }

    // 422, not 401, for the same reason as changePassword.
    if (!await bcrypt.compare(password, user.passwordHash)) {
        throw new ApiError(422, "Password is incorrect", [
            { field: "password", message: "Password is incorrect" },
        ]);
    }

    // A hash of a random value nobody knows: no password matches it.
    const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
        // Only if the password checked above is still the current one.
        const { count } = await tx.user.updateMany({
            where: { id: userId, passwordHash: user.passwordHash },
            data: {
                email: `deleted-${userId}-${crypto.randomBytes(6).toString("hex")}@deleted.invalid`,
                firstName: "Deleted",
                lastName: "User",
                phone: null,
                passwordHash: unusableHash,
                emailVerifiedAt: null,
            },
        });

        if (count === 0) {
            throw new ApiError(409, "Your password was just changed by another request. Please try again.");
        }

        await tx.address.deleteMany({ where: { userId } });
        await tx.cart.deleteMany({ where: { userId } });
        await tx.userToken.deleteMany({ where: { userId } });
        await tx.refreshToken.deleteMany({ where: { userId } });
    });
}
