import HomePage from "@/pages/homePage.vue";
import ProductsPage from "@/pages/productsPage.vue";
import ProductDetailsPage from "@/pages/productDetailsPage.vue";
import CartPage from "@/pages/cartPage.vue";
import CheckoutPage from "../pages/checkoutPage.vue";
import OrderSuccess from "../pages/orderSuccess.vue";
import SignInPage from "@/pages/signInPage.vue";
import SignUpPage from "@/pages/signUpPage.vue";
import ForgotPasswordPage from "@/pages/forgotPasswordPage.vue";
import ResetPasswordPage from "@/pages/resetPasswordPage.vue";
import VerifyEmailPage from "@/pages/verifyEmailPage.vue";
import OrdersPage from "@/pages/ordersPage.vue";
import OrderDetailsPage from "@/pages/orderDetailsPage.vue";

export const routes = [

    {
        path: "/",
        name: "home",
        component: HomePage,
    },

    {
        path: "/products",
        name: "products",
        component: ProductsPage,
        meta: { title: "Products" },
    },

    {
        path: "/products/:id",
        name: "product-details",
        component: ProductDetailsPage,
        meta: { title: "Product" },
    },

    {
        path: "/cart",
        name: "cart",
        component: CartPage,
        meta: { title: "Cart" },
    },

    {
        path: "/checkout",
        name: "checkout",
        component: CheckoutPage,
        meta: { title: "Checkout", requiresAuth: true },
    },

    {
        path: "/orderSuccess/:id(\\d+)",
        name: "orderSuccess",
        component: OrderSuccess,
        meta: { title: "Order Confirmed", requiresAuth: true },
    },

    {
        path: "/orders",
        name: "orders",
        component: OrdersPage,
        meta: { title: "Orders", requiresAuth: true },
    },

    {
        path: "/orders/:id(\\d+)",
        name: "order-details",
        component: OrderDetailsPage,
        meta: { title: "Order", requiresAuth: true },
    },

    // /trackOrder and /invoice are not registered until tracking and invoices
    // exist; their pages still render static placeholder data.

    {
        path: "/login",
        name: "login",
        component: SignInPage,
        meta: { title: "Sign In", guestOnly: true },
    },

    {
        path: "/register",
        name: "register",
        component: SignUpPage,
        meta: { title: "Create Account", guestOnly: true },
    },

    {
        path: "/forgot-password",
        name: "forgot-password",
        component: ForgotPasswordPage,
        meta: { title: "Forgot Password" },
    },

    {
        path: "/reset-password",
        name: "reset-password",
        component: ResetPasswordPage,
        meta: { title: "Reset Password" },
    },

    {
        path: "/verify-email",
        name: "verify-email",
        component: VerifyEmailPage,
        meta: { title: "Verify Email" },
    },

    {
        path: "/:pathMatch(.*)*",
        name: "not-found",
        component: () => import("@/pages/notFoundPage.vue"),
        meta: { title: "Page Not Found" },
    },

];