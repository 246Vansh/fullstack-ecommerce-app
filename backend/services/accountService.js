import bcrypt from "bcryptjs";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { SALT_ROUNDS, safeUserSelect } from "./authService.js";
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
