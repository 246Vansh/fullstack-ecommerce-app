// The Place Order button's wording for the chosen method. Online orders are
// created first and then paid in Razorpay Checkout (useCheckout.placeOrder),
// so the button continues to payment; cash on delivery places the order.
export const placeOrderLabel = (paymentMethod) => (paymentMethod === "RAZORPAY" ? "Continue to Payment" : "Place Order");

// While `placing` is true: creating the order, and for online orders also while
// Razorpay Checkout is open, until the payment is verified or abandoned.
export const placingLabel = (paymentMethod) => (paymentMethod === "RAZORPAY" ? "Processing payment…" : "Placing Order...");
