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

    async me() {
        const { data } = await apiClient.get("/auth/me");

        return data;
    },

};
