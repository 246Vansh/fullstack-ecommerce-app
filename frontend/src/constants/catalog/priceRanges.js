import { formatWholePrice } from "@/utils/money";

// Bounds are plain amounts: the API compares them with each product's price
// in that product's own currency. Labels are built with priceRangeLabel, so
// they show the currency of the products on screen instead of a fixed "$".
export const priceRanges = [
    {
        id: 1,
        slug: "under-25",
        min: 0,
        max: 25,
    },

    {
        id: 2,
        slug: "25-50",
        min: 25,
        max: 50,
    },

    {
        id: 3,
        slug: "50-100",
        min: 50,
        max: 100,
    },

    {
        id: 4,
        slug: "100-200",
        min: 100,
        max: 200,
    },

    {
        id: 5,
        slug: "above-200",
        min: 200,
        max: null,
    },
];

// "Under $25", "$25 – $50", "Above $200"; bare numbers when currency is null.
export function priceRangeLabel(range, currency) {
    const format = (value) => formatWholePrice(value, currency);

    if (!range.min) return `Under ${format(range.max)}`;
    if (range.max === null) return `Above ${format(range.min)}`;

    return `${format(range.min)} – ${format(range.max)}`;
}
