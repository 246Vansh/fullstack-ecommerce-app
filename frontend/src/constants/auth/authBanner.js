// Copy for the desktop brand panel beside each auth form (authBanner.vue).
// Only what the store actually does: no customer counts, guarantees or
// product claims. Lifetimes match backend/services/userTokenService.js.

export const authBanners = {

    signIn: {

        badge: "Welcome back",

        title: "Pick up where you left off",

        description: "Sign in to see your orders, use your saved addresses and keep the items in your cart.",

    },

    signUp: {

        badge: "New account",

        // /checkout requires sign-in (route meta.requiresAuth).
        title: "Create an account to check out",

        description: "It keeps your order history, saved addresses and cart in one place.",

    },

    forgotPassword: {

        badge: "Account recovery",

        title: "Reset your password by email",

        description: "If the address matches an account, we'll email a link that works once and expires after 30 minutes.",

    },

    resetPassword: {

        badge: "Account recovery",

        title: "Choose a new password",

        description: "Use at least 8 characters. Saving it signs you out on every device, so you'll sign in again with the new password.",

    },

    verifyEmail: {

        badge: "Email verification",

        title: "Confirm your email address",

        description: "Verification links work once and expire after 24 hours. You can request a new one from your account settings.",

    },

};
