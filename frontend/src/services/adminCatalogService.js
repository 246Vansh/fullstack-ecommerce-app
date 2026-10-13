import { apiClient } from "./apiClient";

// Admin catalog API (/api/admin). The server checks the ADMIN role on every
// request, from the database; the admin pages' route guard is only UX.
// Every product write returns the full admin product (GET /admin/products/:id
// shape), so callers can replace their copy with it.
export const adminCatalogService = {

    // { page, limit, search?, isActive?, categoryId? } -> { data, pagination }.
    // Includes inactive products, unlike the storefront's /products.
    async listProducts(params) {
        const { data } = await apiClient.get("/admin/products", { params });

        return { products: data.data, pagination: data.pagination };
    },

    async getProduct(id) {
        const { data } = await apiClient.get(`/admin/products/${id}`);

        return data.data;
    },

    // { ...details, variants: [1-100], images?: [0-20] }
    async createProduct(payload) {
        const { data } = await apiClient.post("/admin/products", payload);

        return data.data;
    },

    // Only the fields being changed.
    async updateProduct(id, changes) {
        const { data } = await apiClient.patch(`/admin/products/${id}`, changes);

        return data.data;
    },

    // Soft delete: the product leaves the store; PATCH { isActive: true } restores it.
    async deactivateProduct(id) {
        const { data } = await apiClient.delete(`/admin/products/${id}`);

        return data.data;
    },

    // Replaces the whole gallery; array order is display order.
    async replaceImages(id, images) {
        const { data } = await apiClient.put(`/admin/products/${id}/images`, { images });

        return data.data;
    },

    async createVariant(productId, payload) {
        const { data } = await apiClient.post(`/admin/products/${productId}/variants`, payload);

        return data.data;
    },

    // Field changes, plus either { stock } (exact) or { stockAdjustment } (relative).
    async updateVariant(variantId, changes) {
        const { data } = await apiClient.patch(`/admin/variants/${variantId}`, changes);

        return data.data;
    },

    // Soft delete; PATCH { isActive: true } restores it.
    async deactivateVariant(variantId) {
        const { data } = await apiClient.delete(`/admin/variants/${variantId}`);

        return data.data;
    },

    // Every category, inactive included, as a flat list (parentId gives the tree).
    async listCategories() {
        const { data } = await apiClient.get("/admin/categories");

        return data.data;
    },

    async createCategory(payload) {
        const { data } = await apiClient.post("/admin/categories", payload);

        return data.data;
    },

    // There is no category delete: deactivate with { isActive: false }.
    async updateCategory(id, changes) {
        const { data } = await apiClient.patch(`/admin/categories/${id}`, changes);

        return data.data;
    },

};
