import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { authService } from "@/services/authService";
import { setAccessToken, setRefreshHandler } from "@/services/apiClient";

// Session state is kept in memory. On page load, restoreSession() uses the
// httpOnly refresh cookie to get a new access token, so nothing sensitive
// is written to localStorage.
export const useAuthStore = defineStore("auth", () => {

    const user = ref(null);
    const initialized = ref(false);

    const isAuthenticated = computed(() => Boolean(user.value));
    const isAdmin = computed(() => user.value?.role === "ADMIN");

    function setSession(data) {
        user.value = data.user;
        setAccessToken(data.accessToken);
    }

    function clearSession() {
        user.value = null;
        setAccessToken(null);
    }

    async function refreshSession() {
        try {
            setSession(await authService.refresh());
            return true;
        } catch {
            clearSession();
            return false;
        }
    }

    let restorePromise = null;

    // Runs once per page load; the router guard awaits it.
    function restoreSession() {
        restorePromise ??= refreshSession().finally(() => {
            initialized.value = true;
        });

        return restorePromise;
    }

    async function login(credentials) {
        setSession(await authService.login(credentials));
    }

    async function register(details) {
        await authService.register(details);
        await login({ email: details.email, password: details.password, remember: false });
    }

    async function logout() {
        try {
            await authService.logout();
        } finally {
            clearSession();
        }
    }

    setRefreshHandler(refreshSession);

    return {
        user,
        initialized,
        isAuthenticated,
        isAdmin,
        restoreSession,
        login,
        register,
        logout,
    };

});
