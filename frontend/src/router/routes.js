import HomePage from "@/pages/homePage.vue";
import ProductsPage from "@/pages/productsPage.vue";
import ProductDetailsPage from "@/pages/productDetailsPage.vue";
import CartPage from "@/pages/cartPage.vue";
import CheckoutPage from "../pages/checkoutPage.vue";
import OrderSuccess from "../pages/orderSuccess.vue";
import TrackOrder from "../pages/trackOrder.vue";
import SignInPage from "@/pages/signInPage.vue";
import SignUpPage from "@/pages/signUpPage.vue";
import ForgotPasswordPage from "@/pages/forgotPasswordPage.vue";
import ResetPasswordPage from "@/pages/resetPasswordPage.vue";
import VerifyEmailPage from "@/pages/verifyEmailPage.vue";

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
    },

    {
        path: "/products/:id",
        name: "product-details",
        component: ProductDetailsPage,
    },

    {
        path: "/cart",
        name: "cart",
        component: CartPage,
    },

    {
        path: "/checkout",
        name: "checkout",
        component: CheckoutPage,
    },

    {
        path: "/orderSuccess",
        name: "orderSuccess",
        component: OrderSuccess,
    },

    {
        path: "/trackOrder",
        name: "trackOrder",
        component: TrackOrder,
    },

    {
        path: "/login",
        name: "login",
        component: SignInPage,
    },

    {
        path: "/register",
        name: "register",
        component: SignUpPage,
    },

    {
        path: "/forgot-password",
        name: "forgot-password",
        component: ForgotPasswordPage,
    },

    {
        path: "/reset-password",
        name: "reset-password",
        component: ResetPasswordPage,
    },

    {
        path: "/verify-email",
        name: "verify-email",
        component: VerifyEmailPage,
    },

    {
        path: "/:pathMatch(.*)*",
        name: "not-found",
        component: () => import("@/pages/NotFoundPage.vue"),
    },

];