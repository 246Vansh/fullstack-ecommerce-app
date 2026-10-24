import { onMounted, reactive } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "@/stores/authStore";
import { accountService } from "@/services/accountService";
import { parseApiError } from "@/services/apiClient";
import { applyApiError, clearErrors } from "@/composables/useAuth";

// Email verification, signed-in sessions and account deletion on the account
// page. Each part has its own loading/error/success state, like
// useAccountSettings, so one action never disables another.
export function useAccountSecurity() {

    const authStore = useAuthStore();
    const router = useRouter();

    // ==================================================
    // Email verification
    // ==================================================

    const verification = reactive({

        loading: false,

        message: "",

        error: "",

    });

    async function handleResendVerification() {

        verification.loading = true;
        verification.message = "";
        verification.error = "";

        try {

            verification.message = (await accountService.resendVerificationEmail()).message;

        } catch (error) {

            verification.error = parseApiError(error).message;

        } finally {

            verification.loading = false;

        }

    }

    // ==================================================
    // Sessions
    // ==================================================

    const sessions = reactive({

        list: [],

        loading: false,

        // id of the session being signed out, or "others" / "all".
        busy: "",

        error: "",

        success: "",

    });

    async function loadSessions() {

        sessions.loading = true;
        sessions.error = "";

        try {

            sessions.list = await accountService.listSessions();

        } catch (error) {

            sessions.error = parseApiError(error).message;

        } finally {

            sessions.loading = false;

        }

    }

    async function runSessionAction(busy, action, success) {

        sessions.busy = busy;
        sessions.error = "";
        sessions.success = "";

        try {

            await action();
            sessions.success = success;
            await loadSessions();

        } catch (error) {

            sessions.error = parseApiError(error).message;

        } finally {

            sessions.busy = "";

        }

    }

    const handleRevokeSession = (id) => runSessionAction(id, () => accountService.revokeSession(id), "That device has been signed out.");

    const handleRevokeOtherSessions = () => runSessionAction("others", () => accountService.revokeOtherSessions(), "All your other devices have been signed out.");

    // Ends this session too, so there is nothing left to reload.
    async function handleLogoutEverywhere() {

        sessions.busy = "all";

        try {

            await authStore.logoutAll();

        } finally {

            sessions.busy = "";

        }

        await router.push({ name: "login" });

    }

    onMounted(loadSessions);

    // ==================================================
    // Delete account
    // ==================================================

    const deletion = reactive({

        password: "",

        confirmed: false,

        loading: false,

        errors: {

            password: "",

            confirmed: "",

            form: "",

        },

    });

    async function handleDeleteAccount() {

        clearErrors(deletion.errors);

        if (!deletion.password) deletion.errors.password = "Enter your password to confirm";
        if (!deletion.confirmed) deletion.errors.confirmed = "Confirm that you understand this cannot be undone";

        if (Object.values(deletion.errors).some(Boolean)) {
            return;
        }

        deletion.loading = true;

        try {

            await accountService.deleteAccount({ password: deletion.password });

            deletion.password = "";

            // The server already ended every session; this clears the cookie
            // and this tab's state (and tells other tabs).
            await authStore.logout().catch(() => {});

            await router.push({ name: "home" });

        } catch (error) {

            applyApiError(deletion.errors, error, "form");

        } finally {

            deletion.loading = false;

        }

    }

    return {

        verification,

        sessions,

        deletion,

        handleResendVerification,

        loadSessions,

        handleRevokeSession,

        handleRevokeOtherSessions,

        handleLogoutEverywhere,

        handleDeleteAccount,

    };

}
