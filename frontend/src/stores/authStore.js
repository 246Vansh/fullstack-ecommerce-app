import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { authService } from "@/services/authService";
import { setAccessToken, setRefreshHandler, notifySessionExpired } from "@/services/apiClient";

// Tells this app's other tabs about sign-in and sign-out. Cookies are shared
// between tabs but each tab's access token and user are its own memory.
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("auth");

// Node only (unit tests): an open channel would keep the process alive.
channel?.unref?.();

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
        channel?.postMessage("login");
    }

    async function register(details) {
        await authService.register(details);
        await login({ email: details.email, password: details.password, remember: false });
    }

    // After a profile edit: the server's updated user, same shape as login's.
    function updateUser(updated) {
        user.value = updated;
    }

    async function logout() {
        try {
            await authService.logout();
        } finally {
            clearSession();
            channel?.postMessage("logout");
        }
    }

    // Signs out every device, this one included.
    async function logoutAll() {
        try {
            await authService.logoutAll();
        } finally {
            clearSession();
            channel?.postMessage("logout");
        }
    }

    // Another tab signed in: this tab gets its own access token from the
    // shared cookie. Another tab signed out: forget the session here too, and
    // leave protected pages.
    channel?.addEventListener("message", ({ data }) => {
        if (data === "login") {
            refreshSession();
        } else if (data === "logout" && user.value) {
            clearSession();
            notifySessionExpired();
        }
    });

    setRefreshHandler(refreshSession);

    return {
        user,
        initialized,
        isAuthenticated,
        isAdmin,
        restoreSession,
        login,
        register,
        updateUser,
        logout,
        logoutAll,
    };

});
