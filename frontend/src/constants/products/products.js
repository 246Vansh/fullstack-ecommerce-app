export const products = [
    {
        id: 1,
        name: "Classic Cotton T-Shirt",
        slug: "classic-cotton-t-shirt",
        brandId: 10, // Uniqlo
        categoryId: 1, // Men
        subcategoryId: 101, // T-Shirts
        price: 49.99,
        originalPrice: 69.99,
        quantity: 1,
        rating: 4.8,
        reviewCount: 126,
        badgeId: 3,
        isNew: false,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1503341504253-dff4815485f1",

        images: [
            "https://images.unsplash.com/photo-1503341504253-dff4815485f1",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
            "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f",
        ],

        colorIds: [1, 2, 3], // Black White Gray
        sizeIds: [2, 3, 4, 5], // S M L XL
        description: "Premium cotton t-shirt designed for everyday comfort and timeless style.",
        reviews: [
            {
                id: 1,
                reviewerName: "John Carter",
                rating: 5,
                date: "2 days ago",
                comment:
                    "Excellent quality. The fabric feels premium and the fit is exactly as expected.",
            },

            {
                id: 2,
                reviewerName: "Sophia Wilson",
                rating: 4,
                date: "1 week ago",
                comment:
                    "Very comfortable for everyday wear. Delivery was also very fast.",
            },

            {
                id: 3,
                reviewerName: "Michael Brown",
                rating: 5,
                date: "2 weeks ago",
                comment:
                    "Looks even better than the pictures. Definitely worth the price.",
            },

            {
                id: 4,
                reviewerName: "Emma Johnson",
                rating: 4,
                date: "3 weeks ago",
                comment:
                    "Great quality overall. I would buy another color as well.",
            },
        ],
    },

    {
        id: 2,
        name: "Relaxed Denim Jeans",
        slug: "relaxed-denim-jeans",
        brandId: 8, // Zara
        categoryId: 1, // Men
        subcategoryId: 103, // Jackets
        price: 129.99,
        originalPrice: 159.99,
        quantity: 1,
        rating: 4.9,
        reviewCount: 84,
        badgeId: 1,
        isNew: true,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1542272604-787c3835535d",

        images: [
            "https://images.unsplash.com/photo-1542272604-787c3835535d",
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723a",
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
        ],

        colorIds: [4, 1], // Blue Black
        sizeIds: [3, 4, 5], // M L XL
        description: "Relaxed-fit denim jacket with premium stitching and a modern silhouette.",
        reviews: [
            {
                id: 1,
                reviewerName: "Daniel Lee",
                rating: 5,
                date: "5 days ago",
                comment:
                    "One of the best denim jackets I've purchased. Premium stitching and excellent fit.",
            },

            {
                id: 2,
                reviewerName: "Olivia Smith",
                rating: 5,
                date: "8 days ago",
                comment:
                    "Stylish, comfortable and perfect for casual outfits.",
            },

            {
                id: 3,
                reviewerName: "James Taylor",
                rating: 4,
                date: "2 weeks ago",
                comment:
                    "Very good jacket although sleeves are slightly longer for me.",
            },
        ],
    },

    {
        id: 3,
        name: "Minimal Leather Sneakers",
        slug: "minimal-leather-sneakers",
        brandId: 4, // New Balance
        categoryId: 3, // Shoes
        subcategoryId: 301, // Sneakers
        price: 159.99,
        originalPrice: 199.99,
        quantity: 1,
        rating: 4.7,
        reviewCount: 212,
        badgeId: 2,
        isNew: false,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff",

        images: [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
            "https://images.unsplash.com/photo-1460353581641-37baddab0fa2",
            "https://images.unsplash.com/photo-1491553895911-0055eca6402d",
        ],

        colorIds: [2, 1], // White Black
        sizeIds: [101, 102, 103, 104, 105], // 40 41 42 43 44
        description: "Minimal leather sneakers crafted for everyday luxury and comfort.",
        reviews: [
            {
                id: 1,
                reviewerName: "Lucas Martin",
                rating: 5,
                date: "Yesterday",
                comment:
                    "Extremely comfortable. Perfect for long walks.",
            },

            {
                id: 2,
                reviewerName: "Charlotte Green",
                rating: 5,
                date: "6 days ago",
                comment:
                    "The leather quality is fantastic. Looks very premium.",
            },

            {
                id: 3,
                reviewerName: "Henry Walker",
                rating: 4,
                date: "10 days ago",
                comment:
                    "Nice sneakers with great cushioning.",
            },

            {
                id: 4,
                reviewerName: "Amelia White",
                rating: 5,
                date: "2 weeks ago",
                comment:
                    "Love these shoes! Comfortable from day one.",
            },
        ],
    },
    {
        id: 4,
        name: "Relaxed Denim Jeans",
        slug: "relaxed-denim-jeans",
        brandId: 8, // Zara
        categoryId: 1, // Men
        subcategoryId: 103, // Jackets
        price: 129.99,
        originalPrice: 159.99,
        quantity: 1,
        rating: 4.9,
        reviewCount: 84,
        badgeId: 1,
        isNew: true,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",

        images: [
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723a",
            "https://images.unsplash.com/photo-1542272604-787c3835535d",
        ],

        colorIds: [4, 1], // Blue Black
        sizeIds: [3, 4, 5], // M L XL
        description: "Relaxed-fit denim jacket with premium stitching and a modern silhouette.",
        reviews: [
            {
                id: 1,
                reviewerName: "Daniel Lee",
                rating: 5,
                date: "5 days ago",
                comment:
                    "One of the best denim jackets I've purchased. Premium stitching and excellent fit.",
            },

            {
                id: 2,
                reviewerName: "Olivia Smith",
                rating: 5,
                date: "8 days ago",
                comment:
                    "Stylish, comfortable and perfect for casual outfits.",
            },

            {
                id: 3,
                reviewerName: "James Taylor",
                rating: 4,
                date: "2 weeks ago",
                comment:
                    "Very good jacket although sleeves are slightly longer for me.",
            },
        ],
    },
    {
        id: 5,
        name: "Relaxed Denim Jeans",
        slug: "relaxed-denim-jeans",
        brandId: 8, // Zara
        categoryId: 1, // Men
        subcategoryId: 103, // Jackets
        price: 129.99,
        originalPrice: 159.99,
        quantity: 1,
        rating: 4.9,
        reviewCount: 84,
        badgeId: 1,
        isNew: true,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",

        images: [
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723a",
            "https://images.unsplash.com/photo-1542272604-787c3835535d",
        ],

        colorIds: [4, 1], // Blue Black
        sizeIds: [3, 4, 5], // M L XL
        description: "Relaxed-fit denim jacket with premium stitching and a modern silhouette.",
        reviews: [
            {
                id: 1,
                reviewerName: "Daniel Lee",
                rating: 5,
                date: "5 days ago",
                comment:
                    "One of the best denim jackets I've purchased. Premium stitching and excellent fit.",
            },

            {
                id: 2,
                reviewerName: "Olivia Smith",
                rating: 5,
                date: "8 days ago",
                comment:
                    "Stylish, comfortable and perfect for casual outfits.",
            },

            {
                id: 3,
                reviewerName: "James Taylor",
                rating: 4,
                date: "2 weeks ago",
                comment:
                    "Very good jacket although sleeves are slightly longer for me.",
            },
        ],
    },
    {
        id: 6,
        name: "Relaxed Denim Jeans",
        slug: "relaxed-denim-jeans",
        brandId: 8, // Zara
        categoryId: 1, // Men
        subcategoryId: 103, // Jackets
        price: 129.99,
        originalPrice: 159.99,
        quantity: 1,
        rating: 4.9,
        reviewCount: 84,
        badgeId: 1,
        isNew: true,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",

        images: [
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723a",
            "https://images.unsplash.com/photo-1542272604-787c3835535d",
        ],

        colorIds: [4, 1], // Blue Black
        sizeIds: [3, 4, 5], // M L XL
        description: "Relaxed-fit denim jacket with premium stitching and a modern silhouette.",
        reviews: [
            {
                id: 1,
                reviewerName: "Daniel Lee",
                rating: 5,
                date: "5 days ago",
                comment:
                    "One of the best denim jackets I've purchased. Premium stitching and excellent fit.",
            },

            {
                id: 2,
                reviewerName: "Olivia Smith",
                rating: 5,
                date: "8 days ago",
                comment:
                    "Stylish, comfortable and perfect for casual outfits.",
            },

            {
                id: 3,
                reviewerName: "James Taylor",
                rating: 4,
                date: "2 weeks ago",
                comment:
                    "Very good jacket although sleeves are slightly longer for me.",
            },
        ],
    },
    {
        id: 7,
        name: "Relaxed Denim Jeans",
        slug: "relaxed-denim-jeans",
        brandId: 8, // Zara
        categoryId: 1, // Men
        subcategoryId: 103, // Jackets
        price: 129.99,
        originalPrice: 159.99,
        quantity: 1,
        rating: 4.9,
        reviewCount: 84,
        badgeId: 1,
        isNew: true,
        isFavorite: false,
        inStock: true,

        image:
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",

        images: [
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723a",
            "https://images.unsplash.com/photo-1542272604-787c3835535d",
        ],

        colorIds: [4, 1], // Blue Black
        sizeIds: [3, 4, 5], // M L XL
        description: "Relaxed-fit denim jacket with premium stitching and a modern silhouette.",
        reviews: [
            {
                id: 1,
                reviewerName: "Daniel Lee",
                rating: 5,
                date: "5 days ago",
                comment:
                    "One of the best denim jackets I've purchased. Premium stitching and excellent fit.",
            },

            {
                id: 2,
                reviewerName: "Olivia Smith",
                rating: 5,
                date: "8 days ago",
                comment:
                    "Stylish, comfortable and perfect for casual outfits.",
            },

            {
                id: 3,
                reviewerName: "James Taylor",
                rating: 4,
                date: "2 weeks ago",
                comment:
                    "Very good jacket although sleeves are slightly longer for me.",
            },
        ],
    },
];