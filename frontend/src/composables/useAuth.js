import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/authStore";
import { parseApiError } from "@/services/apiClient";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clearErrors(errors) {
    for (const key of Object.keys(errors)) {
        errors[key] = "";
    }
}

// Copies server field errors onto the form; unknown fields fall back to `fallbackField`.
function applyApiError(errors, error, fallbackField) {
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

        acceptTerms: false,

        errors: {

            firstName: "",

            lastName: "",

            email: "",

            password: "",

            confirmPassword: "",

            acceptTerms: "",

        },

    });

    // ==================================================
    // Forgot Password
    // ==================================================

    const forgotPassword = reactive({

        email: "",

        errors: {

            email: "",

        },

    });

    // ==================================================
    // Reset Password
    // ==================================================

    const resetPassword = reactive({

        password: "",

        confirmPassword: "",

        errors: {

            password: "",

            confirmPassword: "",

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
        if (!signUp.acceptTerms) errors.acceptTerms = "You must accept the terms to continue";

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

            await router.push(safeRedirect(route.query.redirect));

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

        console.log("Forgot Password");

    }

    async function handleResetPassword() {

        console.log("Reset Password");

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