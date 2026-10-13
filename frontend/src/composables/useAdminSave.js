import { reactive, ref } from "vue";

import { parseApiError } from "@/services/apiClient";

// Save state for one admin form or section:
// - saving blocks a second submit while one is in flight;
// - errors holds field messages keyed by API field name (client checks and
//   the server's 422/409 details use the same keys);
// - alert is the form-level message: { kind, message, details };
// - success is announced politely after a save.
export function useAdminSave() {
    const saving = ref(false);
    const errors = reactive({});
    const alert = ref(null);
    const success = ref("");

    function setErrors(next) {
        for (const key of Object.keys(errors)) delete errors[key];
        Object.assign(errors, Object.fromEntries(Object.entries(next).filter(([, message]) => message)));
    }

    function clear() {
        setErrors({});
        alert.value = null;
        success.value = "";
    }

    // Client validation result: show it and stop before calling the API.
    function rejectLocally(fieldErrors) {
        setErrors(fieldErrors);
        success.value = "";
        alert.value = { kind: "invalid", message: "Please fix the highlighted fields.", details: [] };
    }

    // Runs `request` unless a save is already running. `isField(key)` says
    // which server error keys this form shows next to an input; the rest are
    // listed in the alert. Resolves with the response, or undefined on failure.
    async function run(request, { successMessage = "Saved.", isField = () => false } = {}) {
        if (saving.value) return undefined;

        saving.value = true;
        clear();

        try {
            const result = await request();
            success.value = successMessage;
            return result;
        } catch (err) {
            const { status, message, fields } = parseApiError(err);
            const fieldErrors = {};
            const details = [];

            for (const [key, text] of Object.entries(fields)) {
                if (isField(key)) fieldErrors[key] = text;
                else details.push(text);
            }

            setErrors(fieldErrors);

            if (status === 403) {
                alert.value = { kind: "forbidden", message: "Your account is not accepted as an administrator. Sign out and sign in again if your access changed.", details: [] };
            } else if (status === 409) {
                alert.value = { kind: "conflict", message, details: details.filter((text) => text !== message) };
            } else if (status === 422) {
                alert.value = { kind: "invalid", message: Object.keys(fieldErrors).length ? "Please fix the highlighted fields." : message, details };
            } else if (status === 404) {
                alert.value = { kind: "error", message: `${message}. It may have been changed elsewhere; reload the page.`, details: [] };
            } else {
                // Network errors and 5xx: nothing was saved; the form keeps the input.
                alert.value = { kind: "error", message: `${message} Your changes are still here; try saving again.`, details: [] };
            }

            return undefined;
        } finally {
            saving.value = false;
        }
    }

    return { saving, errors, alert, success, setErrors, clear, rejectLocally, run };
}
