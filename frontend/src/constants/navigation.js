// Links open the catalog pre-filtered via the same query params as
// GET /api/products. Slugs must match the categories in the database;
// brand values are the slugs in constants/catalog/brands.js.
const catalog = (query = {}) => ({ name: "products", query });

// Header Navigation
export const navigation = {
    categories: [
        {
            id: "women",
            name: "Women",

            featured: [
                {
                    // The catalog's default sort is newest first.
                    name: "New Arrivals",
                    to: catalog({ category: "women" }),
                    imageSrc:
                        "https://tailwindcss.com/plus-assets/img/ecommerce-images/mega-menu-category-01.jpg",
                    imageAlt: "New Arrivals",
                },
                {
                    name: "Tops",
                    to: catalog({ subcategory: "women-tops" }),
                    imageSrc:
                        "https://tailwindcss.com/plus-assets/img/ecommerce-images/mega-menu-category-02.jpg",
                    imageAlt: "Tops",
                },
            ],

            sections: [
                {
                    id: "clothing",
                    name: "Clothing",

                    items: [
                        { name: "Tops", to: catalog({ subcategory: "women-tops" }) },
                        { name: "Dresses", to: catalog({ subcategory: "women-dresses" }) },
                        { name: "Jeans", to: catalog({ subcategory: "women-jeans" }) },
                        { name: "Jackets", to: catalog({ subcategory: "women-jackets" }) },
                    ],
                },

                {
                    id: "accessories",
                    name: "Accessories",

                    items: [
                        { name: "Wallets", to: catalog({ subcategory: "accessories-wallets" }) },
                        { name: "Bags", to: catalog({ subcategory: "accessories-bags" }) },
                        { name: "Sunglasses", to: catalog({ subcategory: "accessories-sunglasses" }) },
                        { name: "Belts", to: catalog({ subcategory: "accessories-belts" }) },
                    ],
                },

                {
                    id: "brands",
                    name: "Brands",

                    items: [
                        { name: "Calvin Klein", to: catalog({ category: "women", brand: "calvin-klein" }) },
                        { name: "Zara", to: catalog({ category: "women", brand: "zara" }) },
                        { name: "H&M", to: catalog({ category: "women", brand: "hm" }) },
                        { name: "Levi's", to: catalog({ category: "women", brand: "levis" }) },
                        { name: "Uniqlo", to: catalog({ category: "women", brand: "uniqlo" }) },
                    ],
                },
            ],
        },

        {
            id: "men",
            name: "Men",

            featured: [
                {
                    name: "New Arrivals",
                    to: catalog({ category: "men" }),
                    imageSrc:
                        "https://tailwindcss.com/plus-assets/img/ecommerce-images/product-page-04-detail-product-shot-01.jpg",
                    imageAlt: "New Arrivals",
                },
                {
                    name: "T-Shirts",
                    to: catalog({ subcategory: "men-t-shirts" }),
                    imageSrc:
                        "https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-02-image-card-06.jpg",
                    imageAlt: "T-Shirts",
                },
            ],

            sections: [
                {
                    id: "clothing",
                    name: "Clothing",

                    items: [
                        { name: "Shirts", to: catalog({ subcategory: "men-shirts" }) },
                        { name: "T-Shirts", to: catalog({ subcategory: "men-t-shirts" }) },
                        { name: "Jeans", to: catalog({ subcategory: "men-jeans" }) },
                        { name: "Jackets", to: catalog({ subcategory: "men-jackets" }) },
                    ],
                },

                {
                    id: "accessories",
                    name: "Accessories",

                    items: [
                        { name: "Caps", to: catalog({ subcategory: "accessories-caps" }) },
                        { name: "Belts", to: catalog({ subcategory: "accessories-belts" }) },
                        { name: "Wallets", to: catalog({ subcategory: "accessories-wallets" }) },
                        { name: "Shoes", to: catalog({ subcategory: "men-shoes" }) },
                    ],
                },

                {
                    id: "brands",
                    name: "Brands",

                    items: [
                        { name: "Nike", to: catalog({ category: "men", brand: "nike" }) },
                        { name: "Adidas", to: catalog({ category: "men", brand: "adidas" }) },
                        { name: "Levi's", to: catalog({ category: "men", brand: "levis" }) },
                        { name: "Zara", to: catalog({ category: "men", brand: "zara" }) },
                        { name: "Tommy Hilfiger", to: catalog({ category: "men", brand: "tommy-hilfiger" }) },
                    ],
                },
            ],
        },
    ],
};


// Footer Navigation
// Only pages that exist are linked. There are no customer service,
// company or legal pages yet, so those columns are empty and hidden.
export const footerNavigation = {
    products: [
        { name: 'Bags', to: catalog({ subcategory: 'accessories-bags' }) },
        { name: 'Tees', to: catalog({ subcategory: 'men-t-shirts' }) },
        { name: 'Accessories', to: catalog({ category: 'accessories' }) },
    ],
    customerService: [],
    company: [],
    legal: [],
}
