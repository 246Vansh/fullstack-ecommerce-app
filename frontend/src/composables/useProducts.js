import { computed, reactive, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import axios from "axios";

import { productService } from "@/services/productService";
import { parseApiError } from "@/services/apiClient";
import {
    brands,
    colors,
    sizes,
    priceRanges,
    availability,
    categories as fallbackCategories,
} from "@/constants/catalog";

export function useProducts() {

    // ==========================
    // Source Data
    // ==========================

    const products = ref([]);

    // Starts with the constants so the sidebar renders before the API answers.
    const categories = ref(fallbackCategories);

    const loading = ref(false);

    const error = ref("");

    const total = ref(0);

    const serverTotalPages = ref(1);

    // ==========================
    // UI State
    // ==========================

    const selectedSort = ref("newest");

    const selectedFilters = reactive({

        category: [],
        subcategory: [],
        brand: [],
        price: null,
        color: [],
        size: [],
        availability: [],

    });

    // Category slugs from a link (/products?category=women) wait here until
    // GET /api/categories answers, because the sidebar filters by category id.
    const pendingSlugs = ref(null);

    let categoriesLoaded = false;

    // A link value that matches no category, subcategory or brand. The
    // catalog then shows an empty state instead of every product. It clears
    // when the shopper changes a filter or follows another link.
    const invalidLinkFilter = ref(false);

    let applyingLink = false;

    const searchQuery = ref("");

    const debouncedSearch = refDebounced(searchQuery, 300);

    // ==========================
    // Pagination
    // ==========================

    const pagination = reactive({
        currentPage: 1,
        itemsPerPage: 12,
    });

    // ==========================
    // Query Mapping
    // ==========================

    // Filter state holds option ids from the sidebar; the API expects
    // slugs (categories) and names (brand, color, size).
    function namesFor(ids, list, field = "name") {
        return list
            .filter((item) => ids.includes(item.id))
            .map((item) => item[field]);
    }

    const query = computed(() => {

        const subcategoryList = categories.value.flatMap((category) => category.subcategories ?? []);

        const price = priceRanges.find((range) => range.id === selectedFilters.price);

        const stockValues = namesFor(selectedFilters.availability, availability, "value");

        const params = {
            search: debouncedSearch.value.trim() || undefined,
            // Pending slugs are sent as-is, so a linked page fetches its
            // filtered results once instead of all products first.
            category: (pendingSlugs.value?.category ?? namesFor(selectedFilters.category, categories.value, "slug")).join(",") || undefined,
            subcategory: (pendingSlugs.value?.subcategory ?? namesFor(selectedFilters.subcategory, subcategoryList, "slug")).join(",") || undefined,
            brand: namesFor(selectedFilters.brand, brands).join(",") || undefined,
            color: namesFor(selectedFilters.color, colors).join(",") || undefined,
            size: namesFor(selectedFilters.size, sizes).join(",") || undefined,
            minPrice: price?.min || undefined,
            maxPrice: price?.max ?? undefined,
            // Both or neither availability boxes ticked means no stock filter.
            inStock: stockValues.length === 1 ? stockValues[0] : undefined,
            sort: selectedSort.value,
            page: pagination.currentPage,
            limit: pagination.itemsPerPage,
        };

        return params;

    });

    // ==========================
    // Fetching
    // ==========================

    let controller = null;

    async function fetchProducts() {

        controller?.abort();

        if (invalidLinkFilter.value) {
            products.value = [];
            total.value = 0;
            serverTotalPages.value = 1;
            loading.value = false;
            error.value = "";
            return;
        }

        const current = new AbortController();
        controller = current;

        loading.value = true;
        error.value = "";

        try {

            const result = await productService.listProducts(query.value, { signal: current.signal });

            products.value = result.products;
            total.value = result.pagination.total;
            serverTotalPages.value = result.pagination.totalPages;

        } catch (err) {

            if (axios.isCancel(err)) return;

            products.value = [];
            total.value = 0;
            error.value = parseApiError(err).message;

        } finally {

            if (!current.signal.aborted) {
                loading.value = false;
            }

        }

    }

    async function fetchCategories() {

        try {
            categories.value = await productService.getCategories();
            categoriesLoaded = true;
            resolvePendingSlugs();
        } catch {
            // Keep the constants as a fallback so the sidebar still renders.
            // Pending link slugs stay as-is and go to the API unchecked.
        }

    }

    function resolvePendingSlugs() {

        if (!pendingSlugs.value) return;

        const { category, subcategory } = pendingSlugs.value;

        const subcategoryList = categories.value.flatMap((item) => item.subcategories ?? []);

        const matchedCategories = categories.value.filter((item) => category.includes(item.slug));
        const matchedSubcategories = subcategoryList.filter((item) => subcategory.includes(item.slug));

        applyingLink = true;

        selectedFilters.category = matchedCategories.map((item) => item.id);
        selectedFilters.subcategory = matchedSubcategories.map((item) => item.id);

        applyingLink = false;

        if (matchedCategories.length < category.length || matchedSubcategories.length < subcategory.length) {
            invalidLinkFilter.value = true;
        }

        pendingSlugs.value = null;

    }

    // One-way: preselects sidebar filters from a navigation link. Nothing
    // is written back to the URL. Unknown values set invalidLinkFilter.
    function applyLinkFilters({ category = [], subcategory = [], brand = [] }) {

        const matchedBrands = brands.filter((item) => brand.includes(item.slug));

        applyingLink = true;

        clearFilters();
        selectedFilters.brand = matchedBrands.map((item) => item.id);

        applyingLink = false;

        invalidLinkFilter.value = matchedBrands.length < brand.length;

        pendingSlugs.value = { category, subcategory };

        if (categoriesLoaded) resolvePendingSlugs();

    }

    // New filters, sort or search start again from page 1.
    watch(
        [selectedSort, debouncedSearch, () => JSON.stringify(selectedFilters)],
        () => {
            pagination.currentPage = 1;
        },
    );

    // Sync so link-driven changes (applyingLink) can be told apart from the shopper's.
    watch(
        () => JSON.stringify(selectedFilters),
        () => {
            if (!applyingLink) invalidLinkFilter.value = false;
        },
        { flush: "sync" },
    );

    // Compared as a string so loading categories alone does not refetch.
    watch([() => JSON.stringify(query.value), invalidLinkFilter], fetchProducts, { immediate: true });

    fetchCategories();

    // ==========================
    // Statistics
    // ==========================

    // The API already filters, sorts and paginates, so these all point
    // at the current page of results.
    const filteredProducts = products;

    const sortedProducts = products;

    const paginatedProducts = products;

    const totalProducts = computed(() => total.value);

    const activeFilterCount = computed(() => {

        let count = 0;

        Object.values(selectedFilters).forEach(value => {

            if (Array.isArray(value)) {
                count += value.length;
            }

            else if (value !== null) {
                count++;
            }

        });

        return count;

    });

    // ==========================
    // Pagination Info
    // ==========================

    const totalPages = computed(() => Math.max(1, serverTotalPages.value));

    // currentPage is a getter/setter so v-model="pagination.currentPage"
    // in productsSection.vue changes the page.
    const paginationInfo = computed(() => {

        const start = (pagination.currentPage - 1) * pagination.itemsPerPage;

        return {
            get currentPage() {
                return pagination.currentPage;
            },
            set currentPage(page) {
                changePage(page);
            },
            itemsPerPage: pagination.itemsPerPage,
            totalItems: total.value,
            totalPages: totalPages.value,
            start: total.value === 0 ? 0 : start + 1,
            end: Math.min(start + pagination.itemsPerPage, total.value),
        };

    });

    // ==========================
    // Actions
    // ==========================

    function changePage(page) {

        if (
            page < 1 ||
            page > totalPages.value
        ) return;

        pagination.currentPage = page;

    }

    function clearFilters() {

        selectedFilters.category = [];
        selectedFilters.subcategory = [];
        selectedFilters.brand = [];
        selectedFilters.price = null;
        selectedFilters.color = [];
        selectedFilters.size = [];
        selectedFilters.availability = [];

    }

    return {

        products,
        categories,
        loading,
        error,
        invalidLinkFilter,

        selectedSort,
        selectedFilters,
        searchQuery,

        pagination,
        paginationInfo,

        paginatedProducts,
        filteredProducts,
        sortedProducts,

        totalProducts,
        activeFilterCount,

        changePage,
        clearFilters,
        applyLinkFilters,
        refetch: fetchProducts,

    };

}
