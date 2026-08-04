export const order = {
    id: "#VLR25841",
    date: "03 Aug 2026",
    status: "Confirmed",
    total: 548.62,
    paymentStatus: "Paid",
};

export const shipping = {
    name: "John Carter",
    phone: "+1 (555) 123-4567",
    address1: "1450 Park Avenue",
    address2: "Apartment 12B",
    city: "New York",
    state: "NY",
    zip: "10029",
    country: "United States",

    deliveryMethod: "Express Delivery",
    estimatedDate: "18 Aug 2026",
    estimatedDay: "Tuesday",
};

export const payment = {
    method: "Visa",
    lastFour: "4832",
    transactionId: "TXN-95842631",
    paymentDate: "03 Aug 2026",
    total: 548.62,
};

export const journey = [

    {
        title: "Order Placed",
        description: "Your order has been received.",
        time: "09:40",
        completed: true,
    },

    {
        title: "Payment Confirmed",
        description: "Payment processed successfully.",
        time: "09:41",
        completed: true,
    },

    {
        title: "Preparing Package",
        description: "Warehouse is packing your order.",
        time: "In Progress",
        completed: true,
    },

    {
        title: "Out for Delivery",
        description: "Your package will leave our warehouse soon.",
        time: "Pending",
        completed: false,
    },

    {
        title: "Delivered",
        description: "Package delivered successfully.",
        time: "Pending",
        completed: false,
    },

];