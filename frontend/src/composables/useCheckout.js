import { ref, computed } from "vue";

import { useCart } from "./useCart";

import { addresses } from "@/constants/checkout/addresses";
import { deliveryMethods } from "@/constants/checkout/deliveryMethods";
import { paymentMethods } from "@/constants/checkout/paymentMethods";

export function useCheckout() {

    /*
    |--------------------------------------------------------------------------
    | Cart
    |--------------------------------------------------------------------------
    */

    const cart = useCart();

    /*
    |--------------------------------------------------------------------------
    | Checkout State
    |--------------------------------------------------------------------------
    */

    const selectedAddress = ref(addresses[0]);

    const selectedDelivery = ref(deliveryMethods[0]);

    const selectedPayment = ref(paymentMethods[0]);

    const coupon = ref(null);

    const notes = ref("");

    const isProcessing = ref(false);

    /*
    |--------------------------------------------------------------------------
    | Pricing
    |--------------------------------------------------------------------------
    */

    const subtotal = computed(() => cart.subtotal.value);

    const discount = computed(() => cart.discount.value);

    const shipping = computed(() => {

        return selectedDelivery.value.price;

    });

    const tax = computed(() => {

        return (subtotal.value - discount.value) * 0.08;

    });

    const total = computed(() => {

        return (

            subtotal.value

            - discount.value

            + shipping.value

            + tax.value

        );

    });

    /*
    |--------------------------------------------------------------------------
    | Methods
    |--------------------------------------------------------------------------
    */

    function selectAddress(id) {

        const address = addresses.find(

            item => item.id === id

        );

        if (address) {

            selectedAddress.value = address;

        }

    }

    function selectDelivery(id) {

        const delivery = deliveryMethods.find(

            item => item.id === id

        );

        if (delivery) {

            selectedDelivery.value = delivery;

        }

    }

    function selectPayment(id) {

        const payment = paymentMethods.find(

            item => item.id === id

        );

        if (payment) {

            selectedPayment.value = payment;

        }

    }

    function applyCoupon(code) {

        coupon.value = code;

    }

    async function placeOrder() {

        isProcessing.value = true;

        try {

            console.log("Create Order");

            /*
            Backend later

            POST /api/orders

            */

        }

        finally {

            isProcessing.value = false;

        }

    }

    return {

        /*
        |--------------------------------------------------------------------------
        | Cart
        |--------------------------------------------------------------------------
        */

        products: cart.products,

        /*
        |--------------------------------------------------------------------------
        | Checkout
        |--------------------------------------------------------------------------
        */

        selectedAddress,

        selectedDelivery,

        selectedPayment,

        coupon,

        notes,

        isProcessing,

        /*
        |--------------------------------------------------------------------------
        | Pricing
        |--------------------------------------------------------------------------
        */

        subtotal,

        discount,

        shipping,

        tax,

        total,

        /*
        |--------------------------------------------------------------------------
        | Methods
        |--------------------------------------------------------------------------
        */

        selectAddress,

        selectDelivery,

        selectPayment,

        applyCoupon,

        placeOrder,

    };

}