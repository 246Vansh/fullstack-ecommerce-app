import bcrypt from "bcryptjs";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

const SALT_ROUNDS = 12;

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

    const passwordMatches = user
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

    if (!user || !passwordMatches) {
        throw new ApiError(401, "Invalid email or password");
    }

    const { passwordHash, ...safeUser } = user;

    return safeUser;
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
