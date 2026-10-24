import { apiClient } from "./apiClient";

export const accountService = {

    // Only the profile fields are sent; the server ignores anything else.
    async updateProfile({ firstName, lastName, phone }) {
        const { data } = await apiClient.patch("/account/profile", {
            firstName,
            lastName,
            phone,
        });

        return data.user;
    },

    async changePassword({ currentPassword, newPassword }) {
        const { data } = await apiClient.post("/account/password", {
            currentPassword,
            newPassword,
        });

        return data;
    },

    async resendVerificationEmail() {
        const { data } = await apiClient.post("/account/verification-email");

        return data;
    },

    async listSessions() {
        const { data } = await apiClient.get("/account/sessions");

        return data.sessions;
    },

    async revokeSession(id) {
        await apiClient.delete(`/account/sessions/${encodeURIComponent(id)}`);
    },

    // Every session except this one.
    async revokeOtherSessions() {
        await apiClient.delete("/account/sessions");
    },

    async deleteAccount({ password }) {
        await apiClient.delete("/account", { data: { password } });
    },

};
