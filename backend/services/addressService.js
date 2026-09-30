import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

export const addressSelect = {
    id: true,
    type: true,
    firstName: true,
    lastName: true,
    phone: true,
    address: true,
    apartment: true,
    city: true,
    state: true,
    zipCode: true,
    country: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
};

// Defaults first, then most recently updated.
const addressOrder = [{ isDefault: "desc" }, { updatedAt: "desc" }, { id: "desc" }];

// Locks the user's row so concurrent writes to their addresses run one after
// another; otherwise two "first address" creates could both become default.
async function lockUser(tx, userId) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

// Every query filters by userId, so another user's address behaves as not found.
async function findOwn(tx, userId, id) {
    const address = await tx.address.findFirst({ where: { id, userId }, select: addressSelect });

    if (!address) {
        throw new ApiError(404, "Address not found");
    }

    return address;
}

// An empty apartment is stored as NULL. (Done here rather than in the
// validator, because matchedData drops optional fields sanitized to null.)
const normalize = (data) => ("apartment" in data ? { ...data, apartment: data.apartment || null } : data);

// One default per user and address type.
const unsetDefaults = (tx, userId, type, exceptId) => tx.address.updateMany({
    where: { userId, type, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
    data: { isDefault: false },
});

export function listAddresses(userId) {
    return prisma.address.findMany({ where: { userId }, select: addressSelect, orderBy: addressOrder });
}

export function getAddress(userId, id) {
    return findOwn(prisma, userId, id);
}

export function createAddress(userId, data) {
    return prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);

        const type = data.type ?? "HOME";
        const hasDefault = await tx.address.count({ where: { userId, type, isDefault: true } });

        // The first address of a type becomes its default.
        const isDefault = data.isDefault === true || hasDefault === 0;

        if (isDefault) await unsetDefaults(tx, userId, type);

        return tx.address.create({
            data: { ...normalize(data), type, isDefault, userId },
            select: addressSelect,
        });
    });
}

export function updateAddress(userId, id, data) {
    return prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);

        const current = await findOwn(tx, userId, id);
        const type = data.type ?? current.type;
        const isDefault = data.isDefault ?? current.isDefault;

        // A default address that changes type stays the default of its new type.
        if (isDefault) await unsetDefaults(tx, userId, type, id);

        return tx.address.update({
            where: { id: current.id },
            data: { ...normalize(data), type, isDefault },
            select: addressSelect,
        });
    });
}

export function deleteAddress(userId, id) {
    return prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);

        const current = await findOwn(tx, userId, id);

        await tx.address.delete({ where: { id: current.id } });

        // Deleting a default promotes the most recent address of the same type.
        if (current.isDefault) {
            const next = await tx.address.findFirst({
                where: { userId, type: current.type },
                orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
                select: { id: true },
            });

            if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
    });
}
