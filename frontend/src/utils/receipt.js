import { formatPrice } from "./money.js";

// Rows for the printable order receipt, built only from the order snapshot
// returned by GET /api/orders/:id. Amounts are the ones saved when the order
// was placed; nothing is re-added or re-priced here, so a later catalog price
// change can never alter a past receipt.
//
// Amounts are formatted as USD: the store is USD-only. Catalog prices have no
// currency, order creation never sets one (the column defaults to "USD"), and
// there is no currency selector. Supporting other currencies would need those
// pieces first, not just a different formatter here.

const isPositive = (value) => Number(value ?? 0) > 0;

export function receiptLines(order) {
    return (order?.items ?? []).map((item) => ({
        id: item.id,
        name: item.productName,
        sku: item.sku || null,
        options: [item.color, item.size].filter(Boolean).join(" / "),
        quantity: item.quantity,
        unitPrice: formatPrice(item.unitPrice),
        lineTotal: formatPrice(item.lineTotal),
    }));
}

// Discount and tax appear only when the order actually stored an amount, so
// the receipt never implies a tax assessment that did not happen.
export function receiptTotals(order) {
    return [
        { label: "Subtotal", value: formatPrice(order.subtotal) },
        { label: "Shipping", value: isPositive(order.shipping) ? formatPrice(order.shipping) : "Free" },
        ...(isPositive(order.discount) ? [{ label: "Discount", value: `-${formatPrice(order.discount)}` }] : []),
        ...(isPositive(order.tax) ? [{ label: "Tax", value: formatPrice(order.tax) }] : []),
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
