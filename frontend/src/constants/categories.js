
// `to` uses the catalog's ?category= slugs from the database.
export const categories = [
  {
    id: 1,
    title: "New Arrivals",
    // The catalog's default sort is newest first.
    to: { name: "products" },
    image:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-03-featured-category.jpg",
    alt: "Two models wearing women's black cotton crewneck tee and off-white cotton crewneck tee.",
    large: true,
  },

  {
    id: 2,
    title: "Accessories",
    to: { name: "products", query: { category: "accessories" } },
    image:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-03-category-01.jpg",
    alt: "Wooden shelf with gray and olive drab green baseball caps, next to wooden clothes hanger with sweaters.",
    large: false,
  },

  {
    // Image is the Shoes category image from constants/catalog/categories.js.
    id: 3,
    title: "Shoes",
    to: { name: "products", query: { category: "shoes" } },
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
    alt: "Shoes",
    large: false,
  },
];
