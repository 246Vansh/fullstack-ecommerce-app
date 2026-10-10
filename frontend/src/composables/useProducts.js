import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

import { productService } from "@/services/productService";
import { parseApiError } from "@/services/apiClient";
import {
    brands,
    colors,
    sizes,
    priceRanges,
    availability,
    sortOptions,
    categories as fallbackCategories,
} from "@/constants/catalog";

const DEFAULT_SORT = "newest";

// Query keys the catalog reads and writes. Any other key in the URL is kept as-is.
const CATALOG_KEYS = [
    "search", "category", "subcategory", "brand", "color", "size",
    "minPrice", "maxPrice", "inStock", "sort", "page",
];

// Same comma-separated format as the API: ?category=women&subcategory=women-tops,women-dresses
const listParam = (value) => [value ?? []].flat()
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);

const firstParam = (value) => String([value].flat()[0] ?? "").trim();

const numberParam = (value) => {
    const text = firstParam(value);
    const number = Number(text);
    return text !== "" && Number.isFinite(number) && number >= 0 ? number : null;
};

// Both availability boxes ticked, or neither, means no stock filter.
function stockFilterFor(ids) {
    const values = availability.filter((item) => ids.includes(item.id)).map((item) => item.value);
    return values.length === 1 ? values[0] : undefined;
}

// The catalog page's state lives in the URL (/products?brand=nike&sort=price-asc&page=2).
// The route is read into the sidebar/sort/pagination state below, and a shopper's
// change to that state is pushed back to the route.
export function useProducts() {

    const route = useRoute();
    const router = useRouter();

    // ==========================
    // Source Data
    // ==========================

    const products = ref([]);

    // Starts with the constants so the sidebar renders before the API answers.
    const categories = ref(fallbackCategories);

    const loading = ref(false);

    const error = ref("");

    // null until a request succeeds, and again after one fails: the count is
    // unknown then, which is not the same as zero matching products.
    const total = ref(null);

    const serverTotalPages = ref(1);

    // ==========================
    // UI State
    // ==========================

    const selectedSort = ref(DEFAULT_SORT);

    // Option ids, except price, which holds a priceRanges slug.
    const selectedFilters = reactive({

        category: [],
        subcategory: [],
        brand: [],
        price: null,
        color: [],
        size: [],
        availability: [],

    });

    // ?minPrice/?maxPrice that match none of the price options. They are
    // still sent to the API; no price option shows as selected.
    const customPrice = ref(null);

    // Category slugs from the URL wait here until GET /api/categories
    // answers, because the sidebar filters by category id.
    const pendingSlugs = ref(null);

    let categoriesLoaded = false;

    // A URL value that matches no category, subcategory, brand, color or
    // size. The catalog then shows an empty state instead of every product.
    // It clears when the shopper changes a filter or follows another link.
    const invalidLinkFilter = ref(false);

    // True while state is being written from the route, so it is not
    // mistaken for a shopper's change and pushed back to the route.
    let applyingLink = false;

    // Set from ?search=, which the header search writes.
    const searchQuery = ref("");

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
    // slugs (categories) and names (brand, color, size), and the URL slugs.
    function namesFor(ids, list, field = "name") {
        return list
            .filter((item) => ids.includes(item.id))
            .map((item) => item[field]);
    }

    const subcategoryList = computed(() => categories.value.flatMap((category) => category.subcategories ?? []));

    const selectedPrice = computed(() =>
        priceRanges.find((range) => range.slug === selectedFilters.price) ?? customPrice.value);

    // Pending slugs are used as-is, so a linked page fetches its filtered
    // results once instead of all products first.
    const categorySlugs = computed(() =>
        pendingSlugs.value?.category ?? namesFor(selectedFilters.category, categories.value, "slug"));

    const subcategorySlugs = computed(() =>
        pendingSlugs.value?.subcategory ?? namesFor(selectedFilters.subcategory, subcategoryList.value, "slug"));

    // GET /api/products parameters.
    const query = computed(() => {

        const price = selectedPrice.value;

        const params = {
            search: searchQuery.value || undefined,
            category: categorySlugs.value.join(",") || undefined,
            subcategory: subcategorySlugs.value.join(",") || undefined,
            brand: namesFor(selectedFilters.brand, brands).join(",") || undefined,
            color: namesFor(selectedFilters.color, colors).join(",") || undefined,
            size: namesFor(selectedFilters.size, sizes).join(",") || undefined,
            minPrice: price?.min || undefined,
            maxPrice: price?.max ?? undefined,
            inStock: stockFilterFor(selectedFilters.availability),
            sort: selectedSort.value,
            page: pagination.currentPage,
            limit: pagination.itemsPerPage,
        };

        return params;

    });

    // The same state as URL query values. Defaults and empty values are
    // left out, so page 1 and the default sort never appear in the URL.
    const urlQuery = computed(() => {

        const price = selectedPrice.value;

        const stock = stockFilterFor(selectedFilters.availability);

        const params = {
            search: searchQuery.value,
            category: categorySlugs.value.join(","),
            subcategory: subcategorySlugs.value.join(","),
            brand: namesFor(selectedFilters.brand, brands, "slug").join(","),
            color: namesFor(selectedFilters.color, colors, "slug").join(","),
            size: namesFor(selectedFilters.size, sizes, "slug").join(","),
            minPrice: price?.min ? String(price.min) : "",
            maxPrice: price?.max != null ? String(price.max) : "",
            inStock: stock === undefined ? "" : String(stock),
            sort: selectedSort.value === DEFAULT_SORT ? "" : selectedSort.value,
            page: pagination.currentPage > 1 ? String(pagination.currentPage) : "",
        };

        return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ""));

    });

    // Query keys the catalog does not own (none today) stay in the URL.
    function otherQuery() {
        return Object.fromEntries(Object.entries(route.query).filter(([key]) => !CATALOG_KEYS.includes(key)));
    }

    // ==========================
    // Route → State
    // ==========================

    function resolvePendingSlugs() {

        if (!pendingSlugs.value) return;

        const { category, subcategory } = pendingSlugs.value;

        const matchedCategories = categories.value.filter((item) => category.includes(item.slug));
        const matchedSubcategories = subcategoryList.value.filter((item) => subcategory.includes(item.slug));

        applyingLink = true;

        selectedFilters.category = matchedCategories.map((item) => item.id);
        selectedFilters.subcategory = matchedSubcategories.map((item) => item.id);

        pendingSlugs.value = null;

        applyingLink = false;

        if (matchedCategories.length < category.length || matchedSubcategories.length < subcategory.length) {
            invalidLinkFilter.value = true;
        }

    }

    function applyRouteQuery(routeQuery) {

        const brandSlugs = listParam(routeQuery.brand);
        const colorSlugs = listParam(routeQuery.color);
        const sizeSlugs = listParam(routeQuery.size);

        const matchedBrands = brands.filter((item) => brandSlugs.includes(item.slug));
        const matchedColors = colors.filter((item) => colorSlugs.includes(item.slug));
        const matchedSizes = sizes.filter((item) => sizeSlugs.includes(item.slug));

        // "Under $25" is ?maxPrice=25, so a missing minPrice matches min 0.
        const minPrice = numberParam(routeQuery.minPrice) || null;
        const maxPrice = numberParam(routeQuery.maxPrice);
        const priceRange = priceRanges.find((range) => (range.min || null) === minPrice && range.max === maxPrice);

        const inStock = firstParam(routeQuery.inStock);
        const stockIds = availability
            .filter((item) => String(item.value) === inStock)
            .map((item) => item.id);

        const sort = firstParam(routeQuery.sort);
        const page = Number.parseInt(firstParam(routeQuery.page), 10);

        applyingLink = true;

        searchQuery.value = firstParam(routeQuery.search);

        selectedSort.value = sortOptions.some((option) => option.value === sort) ? sort : DEFAULT_SORT;

        selectedFilters.brand = matchedBrands.map((item) => item.id);
        selectedFilters.color = matchedColors.map((item) => item.id);
        selectedFilters.size = matchedSizes.map((item) => item.id);

        selectedFilters.price = priceRange?.slug ?? null;
        customPrice.value = !priceRange && (minPrice !== null || maxPrice !== null)
            ? { min: minPrice, max: maxPrice }
            : null;

        // Both boxes and no box mean the same, so the shopper's ticks are kept.
        if (stockFilterFor(selectedFilters.availability) !== stockFilterFor(stockIds)) {
            selectedFilters.availability = stockIds;
        }

        pagination.currentPage = page >= 1 ? page : 1;

        pendingSlugs.value = {
            category: listParam(routeQuery.category),
            subcategory: listParam(routeQuery.subcategory),
        };

        applyingLink = false;

        invalidLinkFilter.value = matchedBrands.length < brandSlugs.length
            || matchedColors.length < colorSlugs.length
            || matchedSizes.length < sizeSlugs.length;

        if (categoriesLoaded) resolvePendingSlugs();

    }

    // ==========================
    // State → Route
    // ==========================

    let navigationQueued = false;

    // One push per change, after the rest of it (clearFilters sets several keys).
    function queueNavigation() {

        if (navigationQueued) return;

        navigationQueued = true;

        Promise.resolve().then(() => {

            navigationQueued = false;

            if (route.name !== "products") return;

            const target = router.resolve({ name: "products", query: { ...otherQuery(), ...urlQuery.value } });

            if (target.fullPath !== route.fullPath) router.push(target);

        });

    }

    // These watchers are sync so a shopper's change can be told apart from
    // a route-driven one (applyingLink). New filters or sort start at page 1.
    watch(
        () => JSON.stringify(selectedFilters),
        () => {
            if (applyingLink) return;
            invalidLinkFilter.value = false;
            pagination.currentPage = 1;
            queueNavigation();
        },
        { flush: "sync" },
    );

    // A changed category drops subcategories that no longer belong to it.
    watch(
        () => [...selectedFilters.category],
        (ids) => {
            if (applyingLink || !selectedFilters.subcategory.length) return;
            const allowed = categories.value
                .filter((item) => ids.includes(item.id))
                .flatMap((item) => (item.subcategories ?? []).map((sub) => sub.id));
            selectedFilters.subcategory = selectedFilters.subcategory.filter((id) => allowed.includes(id));
        },
        { flush: "sync" },
    );

    watch(
        selectedSort,
        () => {
            if (applyingLink) return;
            pagination.currentPage = 1;
            queueNavigation();
        },
        { flush: "sync" },
    );

    watch(
        () => pagination.currentPage,
        () => {
            if (!applyingLink) queueNavigation();
        },
        { flush: "sync" },
    );

    // Runs before the fetch watcher below, so the first request already
    // carries the URL's filters. Leaving the page also changes the route,
    // which is ignored.
    watch(
        () => route.query,
        (routeQuery) => {
            if (route.name === "products") applyRouteQuery(routeQuery);
        },
        { immediate: true },
    );

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
            total.value = null;
            serverTotalPages.value = 1;
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

        let count = customPrice.value ? 1 : 0;

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

    // The current URL without its filters; search and sort stay.
    const clearFiltersTo = computed(() => ({
        name: "products",
        query: {
            ...otherQuery(),
            ...(urlQuery.value.search && { search: urlQuery.value.search }),
            ...(urlQuery.value.sort && { sort: urlQuery.value.sort }),
        },
    }));

    // ==========================
    // Pagination Info
    // ==========================

    const totalPages = computed(() => Math.max(1, serverTotalPages.value));

    // currentPage is a getter/setter so v-model="pagination.currentPage"
    // in productsSection.vue changes the page.
    const paginationInfo = computed(() => {

        const start = (pagination.currentPage - 1) * pagination.itemsPerPage;

        const known = total.value ?? 0;

        return {
            get currentPage() {
                return pagination.currentPage;
            },
            set currentPage(page) {
                changePage(page);
            },
            itemsPerPage: pagination.itemsPerPage,
            // null while the count is unknown (see `total`).
            totalItems: total.value,
            totalPages: totalPages.value,
            start: known === 0 ? 0 : start + 1,
            end: Math.min(start + pagination.itemsPerPage, known),
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

        // customPrice is not part of selectedFilters, so navigate here too.
        customPrice.value = null;
        invalidLinkFilter.value = false;
        pagination.currentPage = 1;
        queueNavigation();

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
        clearFiltersTo,

        changePage,
        clearFilters,
        refetch: fetchProducts,

    };

}
