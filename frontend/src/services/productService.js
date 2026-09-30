import { apiClient } from "./apiClient";

import { brands, colors, sizes } from "@/constants/catalog";

// The UI components still look up brands/colors/sizes by the ids in
// constants/catalog, so API values are matched to those entries by name.
const byName = (list, name) =>
    list.find((item) => item.name.toLowerCase() === String(name).toLowerCase());

const unique = (values) => [...new Set(values.filter(Boolean))];

// Fields the UI expects that the API has no data for yet.
const UNSUPPORTED_DEFAULTS = {
    badgeId: null,
    badge: null,
    rating: 0,
    reviewCount: 0,
    reviews: [],
    isFavorite: false,
};

function normalizeListItem(product) {
    return {
        ...UNSUPPORTED_DEFAULTS,
        ...product,
        brandId: byName(brands, product.brand)?.id ?? null,
        categoryId: product.category?.id ?? null,
    };
}

function normalizeProduct(product) {
    const colorOptions = unique(product.variants.map((variant) => variant.color)).map((name) => {
        const known = byName(colors, name);
        const variant = product.variants.find((item) => item.color === name);

        return {
            id: known?.id ?? name,
            name,
            slug: known?.slug ?? name.toLowerCase(),
            hex: variant.colorHex ?? known?.hex ?? null,
        };
    });

    const sizeOptions = unique(product.variants.map((variant) => variant.size)).map((name) => {
        const known = byName(sizes, name);

        return { id: known?.id ?? name, name, slug: known?.slug ?? name.toLowerCase() };
    });

    return {
        ...UNSUPPORTED_DEFAULTS,
        ...product,
        brandId: byName(brands, product.brand)?.id ?? null,
        categoryId: product.category?.id ?? null,
        images: product.images.map((image) => image.url),
        colors: colorOptions,
        sizes: sizeOptions,
        stock: product.variants.reduce((total, variant) => total + variant.stock, 0),
    };
}

export const productService = {

    // params: see GET /api/products query parameters
    async listProducts(params, { signal } = {}) {
        const { data } = await apiClient.get("/products", { params, signal });

        return {
            products: data.data.map(normalizeListItem),
            pagination: data.pagination,
        };
    },

    async getProduct(id, { signal } = {}) {
        const { data } = await apiClient.get(`/products/${id}`, { signal });

        return normalizeProduct(data.data);
    },

    async getCategories() {
        const { data } = await apiClient.get("/categories");

        return data.data;
    },

};
