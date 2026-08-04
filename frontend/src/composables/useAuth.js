import { reactive, ref } from "vue";

export function useAuth() {

    // ==================================================
    // Loading State
    // ==================================================

    const loading = ref(false);

    // ==================================================
    // Sign In
    // ==================================================

    const signIn = reactive({

        email: "",

        password: "",

        remember: false,

        errors: {

            email: "",

            password: "",

        },

    });

    // ==================================================
    // Sign Up
    // ==================================================

    const signUp = reactive({

        firstName: "",

        lastName: "",

        email: "",

        password: "",

        confirmPassword: "",

        acceptTerms: false,

        errors: {

            firstName: "",

            lastName: "",

            email: "",

            password: "",

            confirmPassword: "",

            acceptTerms: "",

        },

    });

    // ==================================================
    // Forgot Password
    // ==================================================

    const forgotPassword = reactive({

        email: "",

        errors: {

            email: "",

        },

    });

    // ==================================================
    // Reset Password
    // ==================================================

    const resetPassword = reactive({

        password: "",

        confirmPassword: "",

        errors: {

            password: "",

            confirmPassword: "",

        },

    });

    // ==================================================
    // Placeholder Actions
    // ==================================================

    async function handleSignIn() {

        console.log("Sign In");

    }

    async function handleSignUp() {

        console.log("Sign Up");

    }

    async function handleForgotPassword() {

        console.log("Forgot Password");

    }

    async function handleResetPassword() {

        console.log("Reset Password");

    }

    // ==================================================
    // Expose
    // ==================================================

    return {

        loading,

        signIn,

        signUp,

        forgotPassword,

        resetPassword,

        handleSignIn,

        handleSignUp,

        handleForgotPassword,

        handleResetPassword,

    };

}