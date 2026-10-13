import { apiClient } from "./apiClient";

// Admin catalog API (/api/admin). The server checks the ADMIN role on every
// request, from the database; the admin pages' route guard is only UX.
export const adminCatalogService = {

    // { page, limit, search?, isActive?, categoryId? } -> { data, pagination }.
    // Includes inactive products, unlike the storefront's /products.
    async listProducts(params) {
        const { data } = await apiClient.get("/admin/products", { params });

        return { products: data.data, pagination: data.pagination };
    },

    // Every category, inactive included, as a flat list (parentId gives the tree).
    async listCategories() {
        const { data } = await apiClient.get("/admin/categories");

        return data.data;
    },

};
