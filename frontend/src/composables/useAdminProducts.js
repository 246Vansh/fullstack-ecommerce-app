import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { adminCatalogService } from "@/services/adminCatalogService";
import { parseApiError } from "@/services/apiClient";

// Matches the API's default; the server caps limit at 100.
export const ADMIN_PAGE_SIZE = 20;

const STATUS_FILTERS = { active: true, inactive: false };

// The URL is the source of truth for the list (shareable, back/forward work).
// Anything malformed falls back to its default instead of reaching the API,
// which would reject it with a 422.
function parseQuery(query) {
    const text = (value) => (typeof value === "string" ? value : "");
    const search = text(query.search).trim().slice(0, 100);
    const status = Object.hasOwn(STATUS_FILTERS, text(query.status)) ? query.status : "";
    const category = /^[1-9]\d{0,9}$/.test(text(query.category)) ? query.category : "";
    const page = /^[1-9]\d{0,5}$/.test(text(query.page)) ? Number(query.page) : 1;

    return { search, status, category, page };
}

// GET /api/admin/products query: page, limit, search, isActive, categoryId.
function toApiParams({ search, status, category, page }) {
    return {
        page,
        limit: ADMIN_PAGE_SIZE,
        ...(search && { search }),
        ...(status && { isActive: STATUS_FILTERS[status] }),
        ...(category && { categoryId: Number(category) }),
    };
}

// Top-level categories by name, each followed by its subcategories. Choosing a
// top-level category also lists its subcategories' products (server rule).
export function toCategoryOptions(categories) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const children = (id) => categories.filter((category) => category.parentId === id).sort(byName);

    return categories
        .filter((category) => category.parentId === null)
        .sort(byName)
        .flatMap((top) => [top, ...children(top.id)])
        .map((category) => ({
            value: String(category.id),
            label: category.name,
            isChild: category.parentId !== null,
            isActive: category.isActive,
        }));
}

export function useAdminProducts() {
    const route = useRoute();
    const router = useRouter();

    const filters = computed(() => parseQuery(route.query));
    const hasFilters = computed(() => Boolean(filters.value.search || filters.value.status || filters.value.category));

    const products = ref([]);
    const pagination = ref(null);
    const loading = ref(true);
    const error = ref("");
    // The server said 403: the account is signed in but (no longer) an admin.
    const forbidden = ref(false);

    // Only the newest request may update the page; a slow earlier response
    // (e.g. a previous filter) is ignored.
    let latestRequest = 0;

    async function load() {
        const request = ++latestRequest;
        const current = filters.value;

        loading.value = true;
        error.value = "";

        try {
            const result = await adminCatalogService.listProducts(toApiParams(current));

            if (request !== latestRequest) return;

            // Past the last page (e.g. after products were deactivated or a
            // shared link went stale): show the last page instead of nothing.
            const { totalPages } = result.pagination;

            if (!result.products.length && current.page > 1 && totalPages > 0) {
                setFilters({ page: totalPages }, { replace: true });
                return;
            }

            products.value = result.products;
            pagination.value = result.pagination;
            forbidden.value = false;
        } catch (err) {
            if (request !== latestRequest) return;

            const { status, message } = parseApiError(err);

            if (status === 403) {
                forbidden.value = true;
            } else {
                error.value = message;
            }
        } finally {
            if (request === latestRequest) loading.value = false;
        }
    }

    // Changing any filter returns to page 1; changing only the page keeps the rest.
    function setFilters(changes, { replace = false } = {}) {
        const next = { ...filters.value, ...changes };

        if (!("page" in changes)) next.page = 1;

        const query = {
            ...(next.search && { search: next.search }),
            ...(next.status && { status: next.status }),
            ...(next.category && { category: next.category }),
            ...(next.page > 1 && { page: String(next.page) }),
        };

        return replace ? router.replace({ query }) : router.push({ query });
    }

    const clearFilters = () => setFilters({ search: "", status: "", category: "" });

    // ------------------------------------------------------------ categories

    const categoryOptions = ref([]);
    const categoriesError = ref(false);

    async function loadCategories() {
        categoriesError.value = false;

        try {
            categoryOptions.value = toCategoryOptions(await adminCatalogService.listCategories());
        } catch {
            // The list still works without the filter; the select says so.
            categoriesError.value = true;
        }
    }

    function retry() {
        if (categoriesError.value) loadCategories();
        load();
    }

    // Reload whenever this page's query changes (not when leaving the page).
    watch(() => route.query, () => {
        if (route.name === "admin-products") load();
    }, { immediate: true });

    loadCategories();

    return {
        filters,
        hasFilters,
        products,
        pagination,
        loading,
        error,
        forbidden,
        categoryOptions,
        categoriesError,
        setFilters,
        clearFilters,
        retry,
    };
}
