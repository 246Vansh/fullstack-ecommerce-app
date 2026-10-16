import { ref } from "vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";

// Razorpay Checkout, loaded once and only when a customer pays online.
const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise = null;

function loadCheckoutScript() {
    if (window.Razorpay) return Promise.resolve();

    scriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = CHECKOUT_SCRIPT;
        script.async = true;
        script.onload = () => (window.Razorpay ? resolve() : reject(new Error("Razorpay Checkout is unavailable")));
        script.onerror = () => {
            // Allow a later retry to load it again.
            scriptPromise = null;
            script.remove();
            reject(new Error("Razorpay Checkout could not be loaded. Check your connection and try again."));
        };
        document.head.appendChild(script);
    });

    return scriptPromise;
}

// What the customer is told for each outcome. Only PAID comes from a server
// verification; every other state leaves the order payable (or pending).
export const PAYMENT_MESSAGES = {
    PAID: "Payment received. Thank you!",
    PROCESSING: "Your payment is being processed. Refresh the payment status in a moment.",
    FAILED: "The payment did not go through. You can try again.",
    DISMISSED: "The payment was not completed. You can pay for this order whenever you're ready.",
    UNPAID: "No payment has been received for this order yet.",
    UNKNOWN: "We couldn't confirm your payment yet. Refresh the payment status in a moment; you will not be charged twice.",
    // Payment never started (gateway or Checkout unavailable): nothing was charged.
    ERROR: "We couldn't start the payment. Nothing was charged; you can try again below.",
};

// Opens Razorpay Checkout; resolves when it closes: { kind: "success", response }
// after a payment, otherwise "failed" (an attempt failed) or "dismissed".
function openCheckout(session) {
    return new Promise((resolve) => {
        let failed = false;

        const checkout = new window.Razorpay({
            key: session.keyId,
            order_id: session.razorpayOrderId,
            amount: session.amount,
            currency: session.currency,
            name: "E-Commerce",
            description: `Order #${session.orderNumber}`,
            prefill: session.prefill,
            handler: (response) => resolve({ kind: "success", response }),
            modal: { ondismiss: () => resolve({ kind: failed ? "failed" : "dismissed" }) },
        });

        // Checkout stays open after a failed attempt so the customer can retry.
        checkout.on("payment.failed", () => { failed = true; });
        checkout.open();
    });
}

const outcome = (state, order = null, message = PAYMENT_MESSAGES[state]) => ({ state, order, message });

// Pay for an existing online order, or re-check its status. Results:
// { state, order?, message } where order is the server's updated order.
export function useRazorpayPayment() {
    // Set before any request, so a double click opens one checkout.
    const busy = ref(false);

    async function refreshOnce(orderId) {
        try {
            const { state, order } = await orderService.refreshPayment(orderId);
            return outcome(state, order);
        } catch {
            return outcome("UNKNOWN");
        }
    }

    async function pay(orderId) {
        if (busy.value) return null;
        busy.value = true;

        try {
            let session;
            try {
                [session] = await Promise.all([orderService.startPayment(orderId), loadCheckoutScript()]);
            } catch (err) {
                return outcome("ERROR", null, err.response ? parseApiError(err).message : err.message);
            }

            // Checkout throws synchronously if it cannot be built or opened (bad
            // options, blocked script). Nothing was charged; the order stays payable.
            let result;
            try {
                result = await openCheckout(session);
            } catch {
                return outcome("ERROR");
            }

            if (result.kind !== "success") return outcome(result.kind === "failed" ? "FAILED" : "DISMISSED");

            try {
                const { state, order } = await orderService.verifyPayment(orderId, {
                    razorpayOrderId: result.response.razorpay_order_id,
                    razorpayPaymentId: result.response.razorpay_payment_id,
                    razorpaySignature: result.response.razorpay_signature,
                });
                return outcome(state, order);
            } catch {
                // Checkout completed, so the customer may have paid: never report an
                // error here. Whatever the reason (rejected, rate-limited, network or
                // server trouble), the server asks Razorpay directly; PAID if it was,
                // otherwise "couldn't confirm yet".
                return refreshOnce(orderId);
            }
        } finally {
            busy.value = false;
        }
    }

    async function refresh(orderId) {
        if (busy.value) return null;
        busy.value = true;

        try {
            const { state, order } = await orderService.refreshPayment(orderId);
            return outcome(state, order);
        } catch (err) {
            return outcome("ERROR", null, parseApiError(err).message);
        } finally {
            busy.value = false;
        }
    }

    return { busy, pay, refresh };
}
