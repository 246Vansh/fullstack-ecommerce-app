import { apiClient } from "./apiClient";

// The signed-in user's own notifications; the server takes the user from the
// access token, never from these requests.
export const notificationService = {

    // One page, newest first, with the current unread count.
    async list({ page, limit }) {
        const { data } = await apiClient.get("/notifications", { params: { page, limit } });

        return { notifications: data.data, unreadCount: data.unreadCount, pagination: data.pagination };
    },

    async getUnreadCount() {
        const { data } = await apiClient.get("/notifications/unread-count");

        return data.data.count;
    },

    // -> { notification, unreadCount }. Marking a read notification again is harmless.
    async markRead(id) {
        const { data } = await apiClient.patch(`/notifications/${id}/read`);

        return { notification: data.data, unreadCount: data.unreadCount };
    },

    // upToId (optional): only notifications up to that id, so one that arrived
    // after the list was shown stays unread. -> { updated, unreadCount }
    async markAllRead(upToId) {
        const { data } = await apiClient.patch("/notifications/read-all", upToId ? { upToId } : {});

        return data.data;
    },

};
