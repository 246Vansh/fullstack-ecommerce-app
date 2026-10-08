import { nextTick, watch } from "vue";

// After a submit sets field errors (client or server), moves focus to the first
// invalid field so its error, linked with aria-describedby, is read out.
// Deep watching fires on every submit, even when the errors are unchanged.
export function useFocusFirstError(formRef, getErrors) {
    watch(getErrors, async (errors) => {
        if (!Object.values(errors).some(Boolean)) return;

        await nextTick();
        formRef.value?.querySelector("[aria-invalid='true']")?.focus();
    }, { deep: true });
}
