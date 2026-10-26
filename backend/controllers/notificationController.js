import { matchedData } from "express-validator";

import {
    countUnread,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "../services/notificationService.js";

// The owner always comes from the token; the request only picks the page,
// the notification id, or an optional upToId.

export async function getMyNotifications(req, res) {
    const { page, limit } = matchedData(req, { locations: ["query"] });

    const { data, unreadCount, pagination } = await listNotifications(req.user.id, { page, limit });

    res.json({ success: true, data, unreadCount, pagination });
}

export async function getMyUnreadCount(req, res) {
    res.json({ success: true, data: { count: await countUnread(req.user.id) } });
}

export async function readMyNotification(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const { notification, unreadCount } = await markNotificationRead(req.user.id, id);

    res.json({ success: true, data: notification, unreadCount });
}

export async function readAllMyNotifications(req, res) {
    const { upToId } = matchedData(req, { locations: ["body"] });

    res.json({ success: true, data: await markAllNotificationsRead(req.user.id, { upToId }) });
}
