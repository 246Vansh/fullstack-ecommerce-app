import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/authService";
import { parseApiError } from "@/services/apiClient";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt uses at most 72 bytes; the server enforces the same rule.
const MAX_PASSWORD_BYTES = 72;

const byteLength = (value) => new TextEncoder().encode(value).length;

export function clearErrors(errors) {
    for (const key of Object.keys(errors)) {
        errors[key] = "";
    }
}

// Copies server field errors onto the form; unknown fields fall back to `fallbackField`.
export function applyApiError(errors, error, fallbackField) {
    const { message, fields } = parseApiError(error);

    const matched = Object.keys(fields).filter((field) => field in errors);

    for (const field of matched) {
        errors[field] = fields[field];
    }

    if (matched.length === 0) {
        errors[fallbackField] = message;
    }
}

// Only allow same-app paths, never "//evil.com".
function safeRedirect(path) {
    return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
        ? path
        : "/";
}

export function useAuth() {

    const router = useRouter();
    const route = useRoute();
    const authStore = useAuthStore();

    // ==================================================
    // Loading State
    // ==================================================

    const loading = ref(false);

    // ==================================================
    // Sign In
    // ==================================================

    const signIn = reactive({

        email: "",

        password: "",

        remember: false,

        errors: {

            email: "",

            password: "",

        },

    });

    // ==================================================
    // Sign Up
    // ==================================================

    const signUp = reactive({

        firstName: "",

        lastName: "",

        email: "",

        password: "",

        confirmPassword: "",

        errors: {

            firstName: "",

            lastName: "",

            email: "",

            password: "",

            confirmPassword: "",

        },

    });

    // ==================================================
    // Forgot Password
    // ==================================================

    const forgotPassword = reactive({

        email: "",

        success: "",

        errors: {

            email: "",

        },

    });

    // ==================================================
    // Reset Password
    // ==================================================

    // token comes from the emailed link (?token=...); the page removes it
    // from the address bar and keeps it here only.
    const resetPassword = reactive({

        token: typeof route.query.token === "string" ? route.query.token : "",

        password: "",

        confirmPassword: "",

        success: "",

        errors: {

            password: "",

            confirmPassword: "",

            form: "",

        },

    });

    // ==================================================
    // Actions
    // ==================================================

    async function handleSignIn() {

        clearErrors(signIn.errors);

        if (!EMAIL_PATTERN.test(signIn.email.trim())) {
            signIn.errors.email = "Enter a valid email address";
        }

        if (!signIn.password) {
            signIn.errors.password = "Password is required";
        }

        if (signIn.errors.email || signIn.errors.password) {
            return;
        }

        loading.value = true;

        try {

            await authStore.login({
                email: signIn.email.trim(),
                password: signIn.password,
                remember: signIn.remember,
            });

            signIn.password = "";

            await router.push(safeRedirect(route.query.redirect));

        } catch (error) {

            applyApiError(signIn.errors, error, "password");

        } finally {

            loading.value = false;

        }

    }

    async function handleSignUp() {

        clearErrors(signUp.errors);

        const errors = signUp.errors;

        if (!signUp.firstName.trim()) errors.firstName = "First name is required";
        if (!signUp.lastName.trim()) errors.lastName = "Last name is required";
        if (!EMAIL_PATTERN.test(signUp.email.trim())) errors.email = "Enter a valid email address";
        if (signUp.password.length < 8) errors.password = "Use at least 8 characters";
        if (signUp.password !== signUp.confirmPassword) errors.confirmPassword = "Passwords do not match";

        if (Object.values(errors).some(Boolean)) {
            return;
        }

        loading.value = true;

        try {

            await authStore.register({
                firstName: signUp.firstName.trim(),
                lastName: signUp.lastName.trim(),
                email: signUp.email.trim(),
                password: signUp.password,
            });

            signUp.password = "";
            signUp.confirmPassword = "";

            // The new account is signed in; its verification link was just
            // emailed, so show the "check your inbox" page first.
            await router.push({ name: "verify-email" });

        } catch (error) {

            applyApiError(errors, error, "email");

        } finally {

            loading.value = false;

        }

    }

    async function handleLogout() {

        await authStore.logout();

        await router.push({ name: "login" });

    }

    async function handleForgotPassword() {

        clearErrors(forgotPassword.errors);
        forgotPassword.success = "";

        const email = forgotPassword.email.trim();

        if (!EMAIL_PATTERN.test(email)) {
            forgotPassword.errors.email = "Enter a valid email address";
            return;
        }

        loading.value = true;

        try {

            // The same answer whether or not the email has an account.
            const { message } = await authService.forgotPassword({ email });

            forgotPassword.success = message;

        } catch (error) {

            applyApiError(forgotPassword.errors, error, "email");

        } finally {

            loading.value = false;

        }

    }

    const INVALID_LINK = "This reset link is invalid or has expired. Please request a new one.";

    async function handleResetPassword() {

        clearErrors(resetPassword.errors);
        resetPassword.success = "";

        const errors = resetPassword.errors;

        if (!resetPassword.token) {
            errors.form = INVALID_LINK;
            return;
        }

        if (resetPassword.password.length < 8) errors.password = "Use at least 8 characters";
        else if (byteLength(resetPassword.password) > MAX_PASSWORD_BYTES) errors.password = "Password is too long (accented letters and emoji count as more than one character)";
        if (resetPassword.password !== resetPassword.confirmPassword) errors.confirmPassword = "Passwords do not match";

        if (Object.values(errors).some(Boolean)) {
            return;
        }

        loading.value = true;

        try {

            const { message } = await authService.resetPassword({
                token: resetPassword.token,
                password: resetPassword.password,
            });

            // The server signed out every session, this tab's included.
            await authStore.logout().catch(() => {});

            resetPassword.token = "";
            resetPassword.password = "";
            resetPassword.confirmPassword = "";
            resetPassword.success = message;

        } catch (error) {

            applyApiError(errors, error, "form");

            if (error.response?.status === 400) errors.form = INVALID_LINK;

        } finally {

            loading.value = false;

        }

    }

    // ==================================================
    // Expose
    // ==================================================

    return {

        loading,

        signIn,

        signUp,

        forgotPassword,

        resetPassword,

        handleSignIn,

        handleSignUp,

        handleLogout,

        handleForgotPassword,

        handleResetPassword,

    };

}