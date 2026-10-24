import { useAuthStore } from "@/stores/authStore";

// meta.requiresAuth  -> redirect guests to /login?redirect=...
// meta.requiresAdmin -> signed-in non-admins see /forbidden. The role comes
//                       from the server's session response, and is UX only:
//                       the API re-checks it on every admin request.
// meta.guestOnly     -> redirect signed-in users away from auth pages, to the
//                       page they were sent to sign in for (same-app paths only)
export async function authGuard(to) {
    const auth = useAuthStore();

    await auth.restoreSession();

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        return {
            name: "login",
            query: { redirect: to.fullPath },
        };
    }

    if (to.meta.requiresAdmin && !auth.isAdmin) {
        return { name: "forbidden" };
    }

    if (to.meta.guestOnly && auth.isAuthenticated) {
        const { redirect } = to.query;

        return typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")
            && !redirect.startsWith("/login") && !redirect.startsWith("/register")
            ? redirect
            : { name: "home" };
    }

    return true;
}
