import { apiClient } from "./apiClient";

export const authService = {

    async register({ firstName, lastName, email, password }) {
        const { data } = await apiClient.post("/auth/register", {
            firstName,
            lastName,
            email,
            password,
        });

        return data;
    },

    async login({ email, password, remember }) {
        const { data } = await apiClient.post("/auth/login", {
            email,
            password,
            remember,
        });

        return data;
    },

    async refresh() {
        const { data } = await apiClient.post("/auth/refresh");

        return data;
    },

    async logout() {
        await apiClient.post("/auth/logout");
    },

    // Signs out every device of the current user (uses the refresh cookie).
    async logoutAll() {
        await apiClient.post("/auth/logout-all");
    },

    async forgotPassword({ email }) {
        const { data } = await apiClient.post("/auth/forgot-password", { email });

        return data;
    },

    async resetPassword({ token, password }) {
        const { data } = await apiClient.post("/auth/reset-password", { token, password });

        return data;
    },

    async verifyEmail({ token }) {
        const { data } = await apiClient.post("/auth/verify-email", { token });

        return data;
    },

    async me() {
        const { data } = await apiClient.get("/auth/me");

        return data;
    },

};
