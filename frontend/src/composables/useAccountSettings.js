import { reactive } from "vue";

import { useAuthStore } from "@/stores/authStore";
import { accountService } from "@/services/accountService";
import { applyApiError, clearErrors } from "@/composables/useAuth";

// Same rules as the server (routes/accountRoutes.js); the server re-checks.
const PHONE_PATTERN = /^\+?[0-9\s().-]{7,30}$/;
const MAX_NAME = 100;
// bcrypt uses at most 72 bytes; accented letters and emoji take several.
const MAX_PASSWORD_BYTES = 72;

const byteLength = (value) => new TextEncoder().encode(value).length;

// Profile and password are separate forms with their own loading, error and
// success state, so saving one never disables or clears the other. `form`
// holds errors that belong to no single field (rate limit, network).
export function useAccountSettings() {

    const authStore = useAuthStore();

    // ==================================================
    // Profile
    // ==================================================

    const profile = reactive({

        firstName: authStore.user?.firstName ?? "",

        lastName: authStore.user?.lastName ?? "",

        phone: authStore.user?.phone ?? "",

        loading: false,

        success: "",

        errors: {

            firstName: "",

            lastName: "",

            phone: "",

            form: "",

        },

    });

    async function handleUpdateProfile() {

        clearErrors(profile.errors);
        profile.success = "";

        const errors = profile.errors;
        const firstName = profile.firstName.trim();
        const lastName = profile.lastName.trim();
        const phone = profile.phone.trim();

        if (!firstName) errors.firstName = "First name is required";
        else if (firstName.length > MAX_NAME) errors.firstName = `First name must be at most ${MAX_NAME} characters`;

        if (!lastName) errors.lastName = "Last name is required";
        else if (lastName.length > MAX_NAME) errors.lastName = `Last name must be at most ${MAX_NAME} characters`;

        if (phone && !PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid phone number";

        if (Object.values(errors).some(Boolean)) {
            return;
        }

        profile.loading = true;

        try {

            const user = await accountService.updateProfile({ firstName, lastName, phone });

            authStore.updateUser(user);

            profile.firstName = user.firstName;
            profile.lastName = user.lastName;
            profile.phone = user.phone ?? "";
            profile.success = "Your profile has been saved.";

        } catch (error) {

            applyApiError(errors, error, "form");

        } finally {

            profile.loading = false;

        }

    }

    // ==================================================
    // Password
    // ==================================================

    const password = reactive({

        currentPassword: "",

        newPassword: "",

        confirmPassword: "",

        loading: false,

        success: "",

        errors: {

            currentPassword: "",

            newPassword: "",

            confirmPassword: "",

            form: "",

        },

    });

    async function handleChangePassword() {

        clearErrors(password.errors);
        password.success = "";

        const errors = password.errors;

        if (!password.currentPassword) errors.currentPassword = "Current password is required";

        if (password.newPassword.length < 8) errors.newPassword = "Use at least 8 characters";
        else if (byteLength(password.newPassword) > MAX_PASSWORD_BYTES) errors.newPassword = "Password is too long (accented letters and emoji count as more than one character)";
        else if (password.newPassword === password.currentPassword) errors.newPassword = "Choose a password different from your current one";

        if (password.newPassword !== password.confirmPassword) errors.confirmPassword = "Passwords do not match";

        if (Object.values(errors).some(Boolean)) {
            return;
        }

        password.loading = true;

        try {

            await accountService.changePassword({
                currentPassword: password.currentPassword,
                newPassword: password.newPassword,
            });

            password.currentPassword = "";
            password.newPassword = "";
            password.confirmPassword = "";
            password.success = "Your password has been changed. You have been signed out on your other devices.";

        } catch (error) {

            applyApiError(errors, error, "form");

        } finally {

            password.loading = false;

        }

    }

    return {

        profile,

        password,

        handleUpdateProfile,

        handleChangePassword,

    };

}
