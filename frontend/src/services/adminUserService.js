import { apiClient } from "./apiClient";

// Admin user management API (/api/admin/users). The server checks the ADMIN
// role on every request and enforces every rule (no acting on your own
// account, only customers blocked, at least one admin kept). Every write
// returns the updated user, so callers can replace their copy with it.
export const adminUserService = {

    // { page, limit, search?, role?, status? } -> { users, pagination }, newest first.
    // Deleted accounts are only listed with status=deleted.
    async listUsers(params) {
        const { data } = await apiClient.get("/admin/users", { params });

        return { users: data.data, pagination: data.pagination };
    },

    // Blocks a customer and signs them out everywhere.
    async blockUser(id) {
        const { data } = await apiClient.post(`/admin/users/${id}/block`);

        return data.data;
    },

    async unblockUser(id) {
        const { data } = await apiClient.post(`/admin/users/${id}/unblock`);

        return data.data;
    },

    // role: "ADMIN" or "CUSTOMER". currentPassword is the signed-in admin's
    // own password, checked by the server (422 currentPassword when wrong).
    async changeRole(id, { role, currentPassword }) {
        const { data } = await apiClient.patch(`/admin/users/${id}/role`, { role, currentPassword });

        return data.data;
    },

};
