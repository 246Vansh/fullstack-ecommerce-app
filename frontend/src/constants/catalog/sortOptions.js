// "rating-desc" (no reviews yet) and "latest" (same order as "newest") are
// still accepted by the API but are not offered here.
export const sortOptions = [
    {
        id: 1,
        label: "Newest",
        value: "newest",
    },

    {
        id: 2,
        label: "Best Selling",
        value: "best-selling",
    },

    {
        id: 3,
        label: "Price: Low to High",
        value: "price-asc",
    },

    {
        id: 4,
        label: "Price: High to Low",
        value: "price-desc",
    },
];
