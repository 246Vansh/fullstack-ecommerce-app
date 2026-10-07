import { createRouter, createWebHistory } from "vue-router";

import { routes } from "./routes";
import { authGuard } from "./authGuard";
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

// The refresh token was rejected while using the app: send the user to sign
// in again, but only from protected pages; public pages keep working as a guest.
setSessionExpiredHandler(() => {
    const current = router.currentRoute.value;

    if (!current.meta.requiresAuth) return;

    router.replace({ name: "login", query: { redirect: current.fullPath } });
});

export default router;