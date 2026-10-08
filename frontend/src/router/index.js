import { nextTick } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { routes } from "./routes";
import { authGuard } from "./authGuard";
import { focusMainContent, setPageTitle } from "./pageFocus";
import { setSessionExpiredHandler } from "@/services/apiClient";

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
        return {
            top: 0,
        };
    },
});

router.beforeEach(authGuard);

// Pages with loaded data (product, order) refine the title once it arrives.
// Focus moves only when the page itself changes: the first load keeps the
// browser's default, and query-only changes (catalog filters, sort, page)
// leave focus on the control the user is operating.
router.afterEach((to, from, failure) => {
    if (failure) return;

    setPageTitle(to.meta.title);

    if (from.matched.length && to.path !== from.path) {
        nextTick(focusMainContent);
    }
});

// The refresh token was rejected while using the app: send the user to sign
// in again, but only from protected pages; public pages keep working as a guest.
setSessionExpiredHandler(() => {
    const current = router.currentRoute.value;

    if (!current.meta.requiresAuth) return;

    router.replace({ name: "login", query: { redirect: current.fullPath } });
});

export default router;