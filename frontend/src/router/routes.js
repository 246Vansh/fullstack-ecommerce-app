import HomePage from "@/pages/homePage.vue";

// The home page is the usual landing page, so it ships in the main bundle;
// every other page is its own chunk, loaded when its route is first visited.
export const routes = [

    {
        path: "/",
        name: "home",
        component: HomePage,
    },

    {
        path: "/products",
        name: "products",
        component: () => import("@/pages/productsPage.vue"),
        meta: { title: "Products" },
    },

    {
        path: "/products/:id",
        name: "product-details",
        component: () => import("@/pages/productDetailsPage.vue"),
        meta: { title: "Product" },
    },

    {
        path: "/cart",
        name: "cart",
        component: () => import("@/pages/cartPage.vue"),
        meta: { title: "Cart" },
    },

    {
        path: "/checkout",
        name: "checkout",
        component: () => import("@/pages/checkoutPage.vue"),
        meta: { title: "Checkout", requiresAuth: true },
    },

    {
        path: "/orderSuccess/:id(\\d+)",
        name: "orderSuccess",
        component: () => import("@/pages/orderSuccess.vue"),
        meta: { title: "Order Confirmed", requiresAuth: true },
    },

    {
        path: "/orders",
        name: "orders",
        component: () => import("@/pages/ordersPage.vue"),
        meta: { title: "Orders", requiresAuth: true },
    },

    {
        path: "/orders/:id(\\d+)",
        name: "order-details",
        component: () => import("@/pages/orderDetailsPage.vue"),
        meta: { title: "Order", requiresAuth: true },
    },

    // /trackOrder and /invoice are not registered until tracking and invoices
    // exist; their pages still render static placeholder data.

    {
        path: "/login",
        name: "login",
        component: () => import("@/pages/signInPage.vue"),
        meta: { title: "Sign In", guestOnly: true },
    },

    {
        path: "/register",
        name: "register",
        component: () => import("@/pages/signUpPage.vue"),
        meta: { title: "Create Account", guestOnly: true },
    },

    {
        path: "/forgot-password",
        name: "forgot-password",
        component: () => import("@/pages/forgotPasswordPage.vue"),
        meta: { title: "Forgot Password" },
    },

    {
        path: "/reset-password",
        name: "reset-password",
        component: () => import("@/pages/resetPasswordPage.vue"),
        meta: { title: "Reset Password" },
    },

    {
        path: "/verify-email",
        name: "verify-email",
        component: () => import("@/pages/verifyEmailPage.vue"),
        meta: { title: "Verify Email" },
    },

    // Admin area. The guard (meta.requiresAdmin) only decides what to show;
    // the server re-checks the ADMIN role on every /api/admin request.
    {
        path: "/admin",
        component: () => import("@/components/admin/layout/adminLayout.vue"),
        meta: { requiresAuth: true, requiresAdmin: true },
        children: [
            {
                path: "",
                name: "admin",
                redirect: { name: "admin-products" },
            },
            {
                path: "products",
                name: "admin-products",
                component: () => import("@/pages/admin/adminProductsPage.vue"),
                meta: { title: "Products · Admin" },
            },
            // Forms arrive in Phase 12.2B; until then these routes say so.
            {
                path: "products/new",
                name: "admin-product-new",
                component: () => import("@/pages/admin/adminProductFormPage.vue"),
                meta: { title: "New Product · Admin" },
            },
            {
                path: "products/:id(\\d+)/edit",
                name: "admin-product-edit",
                component: () => import("@/pages/admin/adminProductFormPage.vue"),
                meta: { title: "Edit Product · Admin" },
            },
        ],
    },

    {
        path: "/forbidden",
        name: "forbidden",
        component: () => import("@/pages/forbiddenPage.vue"),
        meta: { title: "Access Denied" },
    },

    {
        path: "/:pathMatch(.*)*",
        name: "not-found",
        component: () => import("@/pages/notFoundPage.vue"),
        meta: { title: "Page Not Found" },
    },

];