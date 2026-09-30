import { useAuthStore } from "@/stores/authStore";

// meta.requiresAuth -> redirect guests to /login?redirect=...
// meta.guestOnly    -> redirect signed-in users away from auth pages
export async function authGuard(to) {
    const auth = useAuthStore();

    await auth.restoreSession();

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        return {
            name: "login",
            query: { redirect: to.fullPath },
        };
    }

    if (to.meta.guestOnly && auth.isAuthenticated) {
        return { name: "home" };
    }

    return true;
}
