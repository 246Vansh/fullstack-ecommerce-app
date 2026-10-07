import axios from "axios";

import { API_CONFIG } from "@/config/api";

// Shared axios instance. The access token lives in memory only;
// the refresh token is an httpOnly cookie the browser sends itself.
export const apiClient = axios.create(API_CONFIG);

let accessToken = null;
let refreshHandler = null;
let sessionExpiredHandler = null;
let refreshPromise = null;

export function setAccessToken(token) {
    accessToken = token;
}

// The auth store registers how to refresh, avoiding a circular import.
export function setRefreshHandler(handler) {
    refreshHandler = handler;
}

// The router registers what to do when a refresh fails mid-session.
export function setSessionExpiredHandler(handler) {
    sessionExpiredHandler = handler;
}

apiClient.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

// On a 401, refresh the access token once and retry the request.
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const isAuthCall = original?.url?.startsWith("/auth/");

        if (error.response?.status !== 401 || !refreshHandler || original?._retry || isAuthCall) {
            throw error;
        }

        original._retry = true;

        // Concurrent 401s share one refresh, so a failed refresh reports once.
        refreshPromise ??= refreshHandler()
            .then((refreshed) => {
                if (!refreshed) sessionExpiredHandler?.();
                return refreshed;
            })
            .finally(() => {
                refreshPromise = null;
            });

        const refreshed = await refreshPromise;

        if (!refreshed) {
            throw error;
        }

        return apiClient(original);
    },
);

// Turns an axios error into { message, fields } for the forms.
export function parseApiError(error) {
    const data = error.response?.data;

    const fields = {};

    for (const detail of data?.details ?? []) {
        fields[detail.field] = detail.message;
    }

    return {
        status: error.response?.status,
        message: data?.message || "Something went wrong. Please try again.",
        fields,
    };
}
