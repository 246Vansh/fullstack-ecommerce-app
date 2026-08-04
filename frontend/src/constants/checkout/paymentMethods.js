import visa from "@/assets/payment/visa-logo.png";
import mastercard from "@/assets/payment/mastercard.webp";
import paypal from "@/assets/payment/paypal-logo.svg";

export const paymentMethods = [

    {
        id: 1,

        name: "Visa",

        logo: visa,

        last4: "4832",
    },

    {
        id: 2,

        name: "Mastercard",

        logo: mastercard,

        last4: "9215",
    },

    {
        id: 3,

        name: "PayPal",

        logo: paypal,

        email: "john@example.com",
    },

];