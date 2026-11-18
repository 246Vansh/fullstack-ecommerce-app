import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { revokeAllUserSessions } from "./refreshTokenService.js";
import { DELETED_EMAIL_DOMAIN } from "./accountService.js";

// Admin user management: list, block/unblock and change roles.
//
// Invariants kept here:
// - Only CUSTOMER accounts are blocked, so an ADMIN is never blocked.
// - An admin never blocks or changes the role of their own account.
// - Deleted accounts (anonymized rows, see accountService) are never changed.
// - The store always keeps an active administrator. Every write locks the
//   acting admin's row and the target's row, always in id order, and
//   re-checks under that lock that the acting admin is still an ADMIN. A
//   demotion therefore commits only while its (different) acting admin holds
//   the ADMIN role, locked against being demoted at the same time: two admins
//   demoting each other are serialized, and the second is refused.
// - A block or role change and the revocation of the target's sessions commit
//   together, in one transaction.

export const ADMIN_USER_PAGINATION = { defaultLimit: 20, maxLimit: 100 };
export const USER_ROLES = ["CUSTOMER", "ADMIN"];
// active: neither blocked nor deleted. The default (no status) is every account except deleted ones.
export const USER_STATUSES = ["active", "blocked", "deleted"];
export const MAX_SEARCH_WORDS = 5;

const DELETED_SUFFIX = `@${DELETED_EMAIL_DOMAIN}`;
const isDeletedEmail = (email) => email.endsWith(DELETED_SUFFIX);
const DELETED = { email: { endsWith: DELETED_SUFFIX } };
const NOT_DELETED = { NOT: DELETED };

// What an admin sees: no password hash, phone, addresses or tokens.
const adminUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    emailVerifiedAt: true,
    createdAt: true,
    blockedAt: true,
    _count: { select: { orders: true } },
};

const toAdminUser = ({ _count, ...user }) => ({ ...user, isDeleted: isDeletedEmail(user.email), orderCount: _count.orders });

const notFound = () => new ApiError(404, "User not found");
const forbidden = () => new ApiError(403, "You do not have permission to perform this action");
const deletedAccount = () => new ApiError(409, "This account has been deleted");
const wrongPassword = () => new ApiError(422, "Password is incorrect", [
    { field: "currentPassword", message: "Password is incorrect" },
]);

const STATUS_WHERE = {
    active: [NOT_DELETED, { blockedAt: null }],
    blocked: [NOT_DELETED, { blockedAt: { not: null } }],
    deleted: [DELETED],
};

// Every word must match the email, first name or last name, so "Ada Lovelace"
// finds her by full name in either order. MySQL's default collation makes it
// case-insensitive. Prisma's contains passes LIKE wildcards through, so \, %
// and _ are escaped with MySQL's default LIKE escape character (\) and match
// literally ("john_doe" does not find "johnxdoe"). Validation also refuses %
// and \ in a search. (Relies on the server not running in the
// NO_BACKSLASH_ESCAPES SQL mode, which MySQL does not enable by default.)
const escapeLike = (word) => word.replace(/[\\%_]/g, "\\$&");

const searchWhere = (search) => search.split(/\s+/).filter(Boolean).map(escapeLike).map((word) => ({
    OR: [{ email: { contains: word } }, { firstName: { contains: word } }, { lastName: { contains: word } }],
}));

export async function listAdminUsers({ page, limit, search, role, status }) {
    const where = {
        AND: [
            ...(status ? STATUS_WHERE[status] : [NOT_DELETED]),
            ...(search ? searchWhere(search) : []),
            ...(role ? [{ role }] : []),
        ],
    };

    const [total, rows] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            select: adminUserSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        data: rows.map(toAdminUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

async function getAdminUser(id) {
    const user = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });

    if (!user) throw notFound();

    return toAdminUser(user);
}

// Locks the acting admin's and the target's rows in id order (the IN list is
// read in primary-key order), so operations on the same accounts wait for each
// other instead of deadlocking; login, refresh and password changes lock one
// users row. Then re-checks the acting admin's role: the one the request was
// authorized with may have changed since.
async function lockActorAndTarget(tx, actorId, targetId) {
    const rows = await tx.$queryRaw`
        SELECT id, email, role, blockedAt, passwordHash FROM users
        WHERE id IN (${Prisma.join([actorId, targetId])}) ORDER BY id FOR UPDATE`;
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    const actor = byId.get(actorId);
    const target = byId.get(targetId);

    if (actor?.role !== "ADMIN") throw forbidden();
    if (!target) throw notFound();
    if (isDeletedEmail(target.email)) throw deletedAccount();

    return { actor, target };
}

// Blocks a customer and ends every session they have (their access tokens stop
// working at once; see middleware/auth.js). Blocking a blocked account keeps
// the original time and revokes any session again.
export async function blockUser(actorId, targetId) {
    if (actorId === targetId) throw new ApiError(403, "You cannot block or unblock your own account");

    await prisma.$transaction(async (tx) => {
        const { target } = await lockActorAndTarget(tx, actorId, targetId);

        if (target.role === "ADMIN") {
            throw new ApiError(409, "Administrators cannot be blocked; change their role to CUSTOMER first");
        }

        if (!target.blockedAt) {
            await tx.user.update({ where: { id: targetId }, data: { blockedAt: new Date() } });
        }

        await revokeAllUserSessions(targetId, { db: tx });
    });

    return getAdminUser(targetId);
}

// Lets the account sign in again. Its old sessions stay ended.
export async function unblockUser(actorId, targetId) {
    if (actorId === targetId) throw new ApiError(403, "You cannot block or unblock your own account");

    await prisma.$transaction(async (tx) => {
        const { target } = await lockActorAndTarget(tx, actorId, targetId);

        if (target.blockedAt) {
            await tx.user.update({ where: { id: targetId }, data: { blockedAt: null } });
        }
    });

    return getAdminUser(targetId);
}

// Promotes a customer to ADMIN or demotes an admin to CUSTOMER. Requires the
// acting admin's current password, and ends the target's sessions so they sign
// in again with the new role.
export async function changeUserRole(actorId, targetId, { role, currentPassword }) {
    if (actorId === targetId) throw new ApiError(403, "You cannot change your own role");

    // bcrypt runs before the transaction, so no row lock is held during it
    // (as in accountService.deleteAccount).
    const acting = await prisma.user.findUnique({ where: { id: actorId }, select: { passwordHash: true } });

    if (!acting) throw forbidden();
    if (!await bcrypt.compare(currentPassword, acting.passwordHash)) throw wrongPassword();

    await prisma.$transaction(async (tx) => {
        const { actor, target } = await lockActorAndTarget(tx, actorId, targetId);

        // Only if the password checked above is still the acting admin's.
        if (actor.passwordHash !== acting.passwordHash) {
            throw new ApiError(409, "Your password was just changed by another request. Please try again.");
        }

        if (target.role === role) throw new ApiError(409, "This user already has that role");

        if (role === "ADMIN" && target.blockedAt) {
            throw new ApiError(409, "Unblock this account before making it an administrator");
        }

        if (role === "CUSTOMER") {
            // The acting admin, locked above and not the target, is one; so
            // this always holds today. Checked anyway, so no future path (say,
            // a demotion without a distinct acting admin) can remove the last.
            const remaining = await tx.user.count({
                where: { role: "ADMIN", id: { not: targetId }, blockedAt: null, ...NOT_DELETED },
            });

            if (remaining === 0) throw new ApiError(409, "The store must keep at least one active administrator");
        }

        await tx.user.update({ where: { id: targetId }, data: { role } });
        await revokeAllUserSessions(targetId, { db: tx });
    });

    return getAdminUser(targetId);
}
