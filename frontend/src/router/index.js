import { createRouter, createWebHistory } from "vue-router";

import { routes } from "./routes";
import { authGuard } from "./authGuard";

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

export default router;