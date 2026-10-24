// The <h1> and intro line of each auth form (authHeader.vue). Sentence case
// throughout; the desktop brand panel copy is in authBanner.js.

export const authPages = {

    signIn: {

        title: "Welcome back",

        description:
            "Sign in to your account to continue shopping.",

    },

    signUp: {

        title: "Create your account",

        description:
            "All it takes is your name, email address and a password.",

    },

    forgotPassword: {

        title: "Forgot your password?",

        description:
            "Enter your email address and we'll send you a link to reset your password.",

    },

    // After a reset link was requested. The server's reply (shown below it)
    // never says whether the address has an account.
    forgotPasswordSent: {

        title: "Check your inbox",

        description: "",

    },

    resetPassword: {

        title: "Choose a new password",

        description:
            "Create a new password for your account.",

    },

    // Reset signs out every session, this tab's included.
    resetPasswordDone: {

        title: "Password updated",

        description:
            "You've been signed out on every device. Sign in with your new password.",

    },

    // Opened without a token (the API's expired/used answer keeps its inline alert).
    resetPasswordInvalid: {

        title: "This reset link can't be used",

        description:
            "Reset links work once and expire after 30 minutes. Request a new one to choose a password.",

    },

    verifyEmail: {

        title: "Verify your email",

        description:
            "Confirm your email address to keep your account secure.",

    },

};
