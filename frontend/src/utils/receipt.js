import { formatPrice } from "./money.js";

// Rows for the printable order receipt, built only from the order snapshot
// returned by GET /api/orders/:id. Amounts are the ones saved when the order
// was placed; nothing is re-added or re-priced here, so a later catalog price
// change can never alter a past receipt.
//
// Every amount is formatted in the order's stored currency: an order placed
// in USD always reads "$", one placed in INR "₹". Nothing is converted.

const isPositive = (value) => Number(value ?? 0) > 0;

export function receiptLines(order) {
    const currency = order?.currency;

    return (order?.items ?? []).map((item) => ({
        id: item.id,
        name: item.productName,
        sku: item.sku || null,
        options: [item.color, item.size].filter(Boolean).join(" / "),
        quantity: item.quantity,
        unitPrice: formatPrice(item.unitPrice, currency),
        lineTotal: formatPrice(item.lineTotal, currency),
    }));
}

// Discount and tax appear only when the order actually stored an amount, so
// the receipt never implies a tax assessment that did not happen.
export function receiptTotals(order) {
    const { currency } = order;

    return [
        { label: "Subtotal", value: formatPrice(order.subtotal, currency) },
        { label: "Shipping", value: isPositive(order.shipping) ? formatPrice(order.shipping, currency) : "Free" },
        ...(isPositive(order.discount) ? [{ label: "Discount", value: `-${formatPrice(order.discount, currency)}` }] : []),
        ...(isPositive(order.tax) ? [{ label: "Tax", value: formatPrice(order.tax, currency) }] : []),
    ];
}

// Missing optional fields (apartment, phone) are skipped instead of leaving
// blank lines or stray commas.
export function receiptAddressLines(address) {
    if (!address) return [];

    const cityLine = [address.city, [address.state, address.zipCode].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");

    return [
        [address.firstName, address.lastName].filter(Boolean).join(" "),
        [address.address, address.apartment].filter(Boolean).join(", "),
        cityLine,
        address.country,
    ].filter(Boolean);
}
