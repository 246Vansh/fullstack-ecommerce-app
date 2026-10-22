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

};
