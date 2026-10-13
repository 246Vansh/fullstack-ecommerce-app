import { onBeforeUnmount, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";

export const DISCARD_MESSAGE = "You have unsaved changes. Leave this page and discard them?";

// Asks before leaving a page with unsaved edits: in-app navigation gets a
// confirm dialog, closing or reloading the tab gets the browser's own prompt.
export function useUnsavedChanges(isDirty) {
    onBeforeRouteLeave(() => !isDirty() || window.confirm(DISCARD_MESSAGE));

    const onBeforeUnload = (event) => {
        if (!isDirty()) return;
        event.preventDefault();
        event.returnValue = "";
    };

    onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
    onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));
}
