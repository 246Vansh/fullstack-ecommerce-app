import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
| Every read and write is scoped by the signed-in user's id, so another
| user's notification behaves exactly like a missing one (404).
|
| createNotification is idempotent by dedupeKey (unique), e.g. "order:42:PAID":
| a second call with the same key creates nothing and reports created: false.
| Only that duplicate is treated as success; every other database error is
| thrown. (createMany's skipDuplicates is not used: on MySQL it is INSERT
| IGNORE, which would also silently drop rows with a bad foreign key.)
*/

export const NOTIFICATION_PAGINATION = { defaultLimit: 20, maxLimit: 50 };

const notificationSelect = {
    id: true,
    type: true,
    title: true,
    message: true,
    orderId: true,
    readAt: true,
    createdAt: true,
};

// dedupeKey is the table's only unique column besides the id, so P2002 here
// always means "this notification already exists".
const isDuplicate = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// `client` may be a transaction (tx), so a later caller can create the
// notification together with the state change it reports.
export async function createNotification({ userId, type, title, message, orderId = null, dedupeKey }, client = prisma) {
    try {
        await client.notification.create({
            data: { userId, type, title, message, orderId, dedupeKey },
        });

        return { created: true };
    } catch (err) {
        if (isDuplicate(err)) return { created: false };
        throw err;
    }
}

/*
| Order lifecycle notifications. Each is sent only by the request whose
| conditional UPDATE actually changed the order (count === 1), after its
| transaction has committed. The key "order:{id}:{type}" makes a repeat
| (retry, concurrent request, second verification) a no-op.
|
| Best effort: the order change has already happened, so a failure to store
| the notification is logged (type, order id, error code only) and never
| reaches the customer or undoes the change.
*/

const ORDER_MESSAGES = {
    ORDER_PLACED: (ref) => ["Order placed", `We've received your order ${ref}.`],
    PAYMENT_RECEIVED: (ref) => ["Payment received", `Your payment for order ${ref} was successful.`],
    ORDER_CONFIRMED: (ref) => ["Order confirmed", `Your order ${ref} has been confirmed.`],
    ORDER_PROCESSING: (ref) => ["Order being prepared", `Your order ${ref} is being prepared for shipping.`],
    ORDER_SHIPPED: (ref) => ["Order shipped", `Your order ${ref} is on its way.`],
    ORDER_DELIVERED: (ref) => ["Order delivered", `Your order ${ref} has been delivered.`],
    ORDER_CANCELLED: (ref) => ["Order cancelled", `Your order ${ref} has been cancelled.`],
};

// `order` needs id, userId (the owner, from the database) and orderNumber.
export async function notifyOrderEvent(order, type) {
    try {
        const [title, message] = ORDER_MESSAGES[type](order.orderNumber ?? `#${order.id}`);

        await createNotification({
            userId: order.userId,
            type,
            title,
            message,
            orderId: order.id,
            dedupeKey: `order:${order.id}:${type}`,
        });
    } catch (err) {
        console.error(`Failed to create ${type} notification for order ${order.id}: ${err?.code ?? err?.name ?? "unknown error"}`);
    }
}

export const countUnread =(userId) => prisma.notification.count({ where: { userId, readAt: null } });

// One page of the user's notifications, newest first; id breaks ties between
// notifications created in the same instant, so pages never overlap. A page
// past the end is empty.
export async function listNotifications(userId, { page, limit }) {
    const where = { userId };

    const [total, notifications, unreadCount] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
            select: notificationSelect,
        }),
        countUnread(userId),
    ]);

    return {
        data: notifications,
        unreadCount,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// Conditional UPDATE: only the owner's unread row matches. Marking a read
// notification again is a no-op that returns it unchanged.
export async function markNotificationRead(userId, id) {
    await prisma.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date() },
    });

    const notification = await prisma.notification.findFirst({ where: { id, userId }, select: notificationSelect });

    if (!notification) throw new ApiError(404, "Notification not found");

    return { notification, unreadCount: await countUnread(userId) };
}

// upToId (optional): only notifications up to that id, so one that arrives
// while the customer is clicking "Mark all as read" stays unread.
export async function markAllNotificationsRead(userId, { upToId } = {}) {
    const { count } = await prisma.notification.updateMany({
        where: { userId, readAt: null, ...(upToId && { id: { lte: upToId } }) },
        data: { readAt: new Date() },
    });

    return { updated: count, unreadCount: await countUnread(userId) };
}
