import { computed, reactive, ref } from "vue";

export function useProducts(initialProducts = []) {

    // ==========================
    // Source Data
    // ==========================

    const products = ref(initialProducts);

    // ==========================
    // UI State
    // ==========================

    const selectedSort = ref("newest");

    const selectedFilters = reactive({

        category: [],
        brand: [],
        price: null,
        color: [],
        size: [],
        availability: [],

    });

    const searchQuery = ref("");

    // ==========================
    // Pagination
    // ==========================

    const pagination = reactive({

        currentPage: 1,

        itemsPerPage: 12,

    });

    // ==========================
    // Filter
    // ==========================

    const filteredProducts = computed(() => {

        let result = [...products.value];

        // Search
        if (searchQuery.value.trim()) {

            const query = searchQuery.value.toLowerCase();

            result = result.filter(product =>

                product.name.toLowerCase().includes(query)

            );

        }

        // Category

        if (selectedFilters.category.length) {

            result = result.filter(product =>

                selectedFilters.category.includes(product.category)

            );

        }

        // Brand

        if (selectedFilters.brand.length) {

            result = result.filter(product =>

                selectedFilters.brand.includes(product.brand)

            );

        }

        // Availability

        if (selectedFilters.availability.length) {

            result = result.filter(product =>

                selectedFilters.availability.includes(

                    product.inStock
                        ? "in-stock"
                        : "out-of-stock"

                )

            );

        }

        return result;

    });

    // ==========================
    // Sorting
    // ==========================

    const sortedProducts = computed(() => {

        const result = [...filteredProducts.value];

        switch (selectedSort.value) {

            case "price-low-high":

                result.sort((a, b) => a.price - b.price);

                break;

            case "price-high-low":

                result.sort((a, b) => b.price - a.price);

                break;

            case "rating":

                result.sort((a, b) => b.rating - a.rating);

                break;

            case "newest":

            default:

                break;

        }

        return result;

    });

    // ==========================
    // Statistics
    // ==========================

    const totalProducts = computed(() =>

        sortedProducts.value.length

    );

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

    const totalPages = computed(() =>

        Math.max(

            1,

            Math.ceil(

                totalProducts.value /
                pagination.itemsPerPage

            )

        )

    );

    const paginationInfo = computed(() => {

        const start =
            (pagination.currentPage - 1)
            * pagination.itemsPerPage;

        const end =
            start + pagination.itemsPerPage;

        return {

            currentPage: pagination.currentPage,

            itemsPerPage: pagination.itemsPerPage,

            totalItems: totalProducts.value,

            totalPages: totalPages.value,

            start: totalProducts.value === 0 ? 0 : start + 1,

            end: Math.min(end, totalProducts.value),

        };

    });

    // ==========================
    // Visible Products
    // ==========================

    const paginatedProducts = computed(() => {

        const start =
            (pagination.currentPage - 1)
            * pagination.itemsPerPage;

        const end =
            start + pagination.itemsPerPage;

        return sortedProducts.value.slice(start, end);

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
        selectedFilters.brand = [];
        selectedFilters.price = null;
        selectedFilters.color = [];
        selectedFilters.size = [];
        selectedFilters.availability = [];

    }

    return {

        products,

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

    };

}