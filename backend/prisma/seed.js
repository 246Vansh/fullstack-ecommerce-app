// Development seed data. Safe to run repeatedly: every record is upserted
// by a unique key (category/product slug, variant sku, user email).
//
// Brand, color and size values must match the names in
// frontend/src/constants/catalog, because the catalog filters send those names.
import "dotenv/config";
import bcrypt from "bcryptjs";

import prisma from "../config/db.js";

// Same cost factor as services/authService.js.
const SALT_ROUNDS = 12;

const IMG = (id) => `https://images.unsplash.com/photo-${id}`;

// ==========================
// Users
// ==========================

const USERS = [
    {
        email: "admin@example.com",
        password: "Admin@12345",
        firstName: "Admin",
        lastName: "User",
        phone: "+1 555 010 0001",
        role: "ADMIN",
    },
    {
        email: "customer@example.com",
        password: "Customer@12345",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+1 555 010 0002",
        role: "CUSTOMER",
    },
];

// ==========================
// Categories
// ==========================

// Top-level slugs match constants/catalog/categories.js. Subcategory names
// match constants/catalog/subCategories.js; their slugs are prefixed with the
// parent slug because Category.slug is unique (Men and Women both have "Jackets").
const CATEGORIES = [
    {
        name: "Men",
        slug: "men",
        description: "Discover timeless essentials crafted for modern lifestyles.",
        image: IMG("1515886657613-9f3515b0c78f"),
        subcategories: ["T-Shirts", "Shirts", "Jackets", "Jeans", "Shoes", "Accessories"],
    },
    {
        name: "Women",
        slug: "women",
        description: "Elegant fashion collections designed for every occasion.",
        image: IMG("1483985988355-763728e1935b"),
        subcategories: ["Dresses", "Tops", "Jackets", "Jeans", "Shoes", "Accessories"],
    },
    {
        name: "Shoes",
        slug: "shoes",
        description: "Premium footwear combining comfort, quality, and style.",
        image: IMG("1542291026-7eec264c27ff"),
        subcategories: ["Sneakers", "Running", "Boots", "Casual", "Formal"],
    },
    {
        name: "Accessories",
        slug: "accessories",
        description: "Complete your look with premium everyday accessories.",
        image: IMG("1523170335258-f5ed11844a49"),
        subcategories: ["Bags", "Belts", "Caps", "Wallets", "Sunglasses"],
    },
];

const slugify = (value) =>
    value.toLowerCase().replace(/&/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ==========================
// Products
// ==========================

// Hex values from constants/catalog/colors.js.
const COLOR_HEX = {
    Black: "#000000",
    White: "#FFFFFF",
    Gray: "#9CA3AF",
    Blue: "#2563EB",
    Navy: "#1E3A8A",
    Green: "#16A34A",
    Olive: "#556B2F",
    Brown: "#8B4513",
    Beige: "#E8D8C4",
    Red: "#DC2626",
    Pink: "#EC4899",
    Yellow: "#FACC15",
};

const CLOTHING = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOES = ["40", "41", "42", "43", "44", "45"];
const clothing = (from, to) => CLOTHING.slice(CLOTHING.indexOf(from), CLOTHING.indexOf(to) + 1);
const shoes = (from, to) => SHOES.slice(SHOES.indexOf(from), SHOES.indexOf(to) + 1);

// `category` is a subcategory slug. `sizes: [null]` means one size only.
// `soldOut: true` gives every variant zero stock (for the availability filter).
const PRODUCTS = [
    // ---------- Men ----------
    {
        name: "Classic Cotton T-Shirt",
        brand: "Uniqlo",
        category: "men-t-shirts",
        price: 19.9,
        originalPrice: 24.9,
        description: "Premium cotton t-shirt designed for everyday comfort and timeless style.",
        images: ["1503341504253-dff4815485f1", "1521572163474-6864f9cf17ab", "1489987707025-afc232f7ea0f"],
        colors: ["Black", "White", "Gray"],
        sizes: clothing("S", "XL"),
    },
    {
        name: "Essential Crew Neck Tee",
        brand: "H&M",
        category: "men-t-shirts",
        price: 12.99,
        isNew: true,
        description: "Lightweight jersey tee with a regular fit and ribbed crew neckline.",
        images: ["1521572163474-6864f9cf17ab", "1503341504253-dff4815485f1"],
        colors: ["White", "Navy", "Olive"],
        sizes: clothing("XS", "XXL"),
    },
    {
        name: "Oxford Button-Down Shirt",
        brand: "Tommy Hilfiger",
        category: "men-shirts",
        price: 79.99,
        originalPrice: 99.99,
        description: "Crisp cotton Oxford shirt with a button-down collar and embroidered flag.",
        images: ["1489987707025-afc232f7ea0f", "1512436991641-6745cdb1723a"],
        colors: ["White", "Blue"],
        sizes: clothing("S", "XL"),
    },
    {
        name: "Slim Fit Linen Shirt",
        brand: "Zara",
        category: "men-shirts",
        price: 45.9,
        description: "Breathable linen-blend shirt with a slim fit, made for warm days.",
        images: ["1512436991641-6745cdb1723a", "1489987707025-afc232f7ea0f"],
        colors: ["Beige", "White"],
        sizes: clothing("S", "L"),
    },
    {
        name: "Classic Trucker Denim Jacket",
        brand: "Levi's",
        category: "men-jackets",
        price: 98.0,
        description: "The original trucker jacket in rigid denim with a timeless fit.",
        images: ["1542272604-787c3835535d", "1515886657613-9f3515b0c78f"],
        colors: ["Blue", "Black"],
        sizes: clothing("M", "XL"),
    },
    {
        name: "Windrunner Hooded Jacket",
        brand: "Nike",
        category: "men-jackets",
        price: 110.0,
        originalPrice: 130.0,
        isNew: true,
        description: "Water-repellent woven jacket with the iconic chevron design.",
        images: ["1515886657613-9f3515b0c78f", "1542272604-787c3835535d"],
        colors: ["Black", "Olive"],
        sizes: clothing("S", "XXL"),
    },
    {
        name: "511 Slim Fit Jeans",
        brand: "Levi's",
        category: "men-jeans",
        price: 69.5,
        description: "Slim through the hip and thigh with a narrow leg opening.",
        images: ["1542272604-787c3835535d", "1512436991641-6745cdb1723a"],
        colors: ["Blue", "Black", "Gray"],
        sizes: clothing("S", "XL"),
    },
    {
        name: "Relaxed Denim Jeans",
        brand: "Zara",
        category: "men-jeans",
        price: 49.9,
        originalPrice: 59.9,
        description: "Relaxed-fit jeans in soft washed denim for all-day comfort.",
        images: ["1542272604-787c3835535d", "1515886657613-9f3515b0c78f"],
        colors: ["Blue", "Black"],
        sizes: clothing("M", "XL"),
    },
    {
        name: "Samba OG Sneakers",
        brand: "Adidas",
        category: "men-shoes",
        price: 100.0,
        description: "Football-inspired classic with a leather upper and gum sole.",
        images: ["1460353581641-37baddab0fa2", "1542291026-7eec264c27ff"],
        colors: ["White", "Black"],
        sizes: shoes("40", "45"),
    },
    {
        name: "Signature Leather Belt",
        brand: "Calvin Klein",
        category: "men-accessories",
        price: 45.0,
        description: "Smooth leather belt with a brushed metal logo buckle.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Brown"],
        sizes: clothing("M", "XL"),
    },

    // ---------- Women ----------
    {
        name: "Floral Midi Dress",
        brand: "Zara",
        category: "women-dresses",
        price: 59.9,
        isNew: true,
        description: "Flowing midi dress with a floral print and adjustable waist tie.",
        images: ["1483985988355-763728e1935b", "1515886657613-9f3515b0c78f"],
        colors: ["Pink", "Beige"],
        sizes: clothing("XS", "L"),
    },
    {
        name: "Satin Slip Dress",
        brand: "H&M",
        category: "women-dresses",
        price: 34.99,
        originalPrice: 49.99,
        description: "Bias-cut satin slip dress with thin adjustable straps.",
        images: ["1515886657613-9f3515b0c78f", "1483985988355-763728e1935b"],
        colors: ["Black", "Red"],
        sizes: clothing("XS", "L"),
    },
    {
        name: "Ribbed Tank Top",
        brand: "Uniqlo",
        category: "women-tops",
        price: 14.9,
        description: "Stretchy ribbed cotton tank that layers under everything.",
        images: ["1483985988355-763728e1935b"],
        colors: ["White", "Black", "Beige"],
        sizes: clothing("XS", "XL"),
    },
    {
        name: "Oversized Poplin Blouse",
        brand: "Calvin Klein",
        category: "women-tops",
        price: 69.0,
        description: "Relaxed cotton poplin blouse with dropped shoulders.",
        images: ["1515886657613-9f3515b0c78f", "1483985988355-763728e1935b"],
        colors: ["White", "Blue"],
        sizes: clothing("XS", "L"),
    },
    {
        name: "Cropped Puffer Jacket",
        brand: "Puma",
        category: "women-jackets",
        price: 129.0,
        originalPrice: 160.0,
        isNew: true,
        description: "Warm cropped puffer with a high collar and recycled fill.",
        images: ["1515886657613-9f3515b0c78f"],
        colors: ["Black", "Pink"],
        sizes: clothing("XS", "L"),
    },
    {
        name: "High-Rise Straight Jeans",
        brand: "Levi's",
        category: "women-jeans",
        price: 89.5,
        description: "High-rise jeans with a straight leg and vintage-inspired wash.",
        images: ["1542272604-787c3835535d", "1483985988355-763728e1935b"],
        colors: ["Blue", "Black"],
        sizes: clothing("XS", "L"),
    },
    {
        name: "Gazelle Sneakers",
        brand: "Adidas",
        category: "women-shoes",
        price: 100.0,
        description: "Low-profile suede sneakers with contrast 3-Stripes.",
        images: ["1460353581641-37baddab0fa2", "1491553895911-0055eca6402d"],
        colors: ["Pink", "White"],
        sizes: shoes("40", "42"),
    },
    {
        name: "Leather Crossbody Bag",
        brand: "Calvin Klein",
        category: "women-accessories",
        price: 148.0,
        description: "Compact crossbody bag in pebbled leather with an adjustable strap.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Beige"],
        sizes: [null],
    },

    // ---------- Shoes ----------
    {
        name: "Air Max 90",
        brand: "Nike",
        category: "shoes-sneakers",
        price: 140.0,
        description: "Iconic Air cushioning with a waffle outsole and layered upper.",
        images: ["1542291026-7eec264c27ff", "1460353581641-37baddab0fa2", "1491553895911-0055eca6402d"],
        colors: ["White", "Black", "Red"],
        sizes: shoes("40", "45"),
    },
    {
        name: "574 Core Sneakers",
        brand: "New Balance",
        category: "shoes-sneakers",
        price: 89.99,
        originalPrice: 99.99,
        description: "The versatile 574 with ENCAP midsole cushioning.",
        images: ["1491553895911-0055eca6402d", "1542291026-7eec264c27ff"],
        colors: ["Gray", "Navy"],
        sizes: shoes("40", "45"),
    },
    {
        name: "Ultraboost Light Running Shoes",
        brand: "Adidas",
        category: "shoes-running",
        price: 190.0,
        description: "Lightweight Boost cushioning for energised everyday runs.",
        images: ["1460353581641-37baddab0fa2", "1542291026-7eec264c27ff"],
        colors: ["Black", "White"],
        sizes: shoes("40", "45"),
    },
    {
        name: "Deviate Nitro 3",
        brand: "Puma",
        category: "shoes-running",
        price: 160.0,
        isNew: true,
        description: "Carbon-plated trainer with NITRO foam for fast training days.",
        images: ["1542291026-7eec264c27ff"],
        colors: ["Blue", "Yellow"],
        sizes: shoes("41", "45"),
    },
    {
        name: "Leather Chelsea Boots",
        brand: "Zara",
        category: "shoes-boots",
        price: 119.0,
        description: "Classic Chelsea boots with elastic side panels and a track sole.",
        images: ["1491553895911-0055eca6402d"],
        colors: ["Black", "Brown"],
        sizes: shoes("40", "45"),
    },
    {
        name: "Suede Penny Loafers",
        brand: "Tommy Hilfiger",
        category: "shoes-casual",
        price: 129.9,
        description: "Soft suede loafers with a cushioned footbed.",
        images: ["1491553895911-0055eca6402d", "1460353581641-37baddab0fa2"],
        colors: ["Brown", "Navy"],
        sizes: shoes("40", "44"),
    },
    {
        name: "Leather Derby Shoes",
        brand: "Calvin Klein",
        category: "shoes-formal",
        price: 210.0,
        description: "Polished leather Derby shoes with a sleek almond toe.",
        images: ["1491553895911-0055eca6402d"],
        colors: ["Black", "Brown"],
        sizes: shoes("40", "45"),
    },

    // ---------- Accessories ----------
    {
        name: "Heritage Backpack",
        brand: "Nike",
        category: "accessories-bags",
        price: 45.0,
        description: "Durable everyday backpack with a padded laptop sleeve.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Navy", "Gray"],
        sizes: [null],
    },
    {
        name: "Reversible Leather Belt",
        brand: "Tommy Hilfiger",
        category: "accessories-belts",
        price: 55.0,
        description: "Two looks in one: reversible leather belt with a rotating buckle.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Brown"],
        sizes: clothing("M", "XL"),
    },
    {
        name: "Classic Baseball Cap",
        brand: "New Balance",
        category: "accessories-caps",
        price: 22.0,
        description: "Six-panel cotton twill cap with an adjustable strap.",
        images: ["1523381210434-271e8be1f52b"],
        colors: ["Black", "White", "Olive"],
        sizes: [null],
    },
    {
        name: "Bifold Leather Wallet",
        brand: "Calvin Klein",
        category: "accessories-wallets",
        price: 65.0,
        description: "Slim bifold wallet in smooth leather with RFID protection.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Brown"],
        sizes: [null],
    },
    {
        name: "Aviator Sunglasses",
        brand: "Zara",
        category: "accessories-sunglasses",
        price: 29.9,
        description: "Metal-frame aviators with UV400 tinted lenses.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black", "Brown"],
        sizes: [null],
    },
    {
        name: "Retro Round Sunglasses",
        brand: "H&M",
        category: "accessories-sunglasses",
        price: 17.99,
        description: "Round acetate sunglasses with a vintage feel.",
        images: ["1523170335258-f5ed11844a49"],
        colors: ["Black"],
        sizes: [null],
        soldOut: true,
    },
];

// ==========================
// Seeders
// ==========================

async function seedUsers() {
    for (const { password, ...user } of USERS) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const data = { ...user, passwordHash, emailVerifiedAt: new Date() };

        await prisma.user.upsert({
            where: { email: user.email },
            update: data,
            create: data,
        });
    }
}

// Returns a map of subcategory slug -> id.
async function seedCategories() {
    const ids = {};

    for (const { subcategories, ...category } of CATEGORIES) {
        const data = { ...category, parentId: null, isActive: true };
        const parent = await prisma.category.upsert({
            where: { slug: category.slug },
            update: data,
            create: data,
        });

        for (const name of subcategories) {
            const slug = `${category.slug}-${slugify(name)}`;
            const childData = { name, slug, parentId: parent.id, isActive: true };
            const child = await prisma.category.upsert({
                where: { slug },
                update: childData,
                create: childData,
            });

            ids[slug] = child.id;
        }
    }

    return ids;
}

// Deterministic stock so repeated runs produce the same data;
// some combinations land on 0 to look like real sold-out sizes.
const stockFor = (productIndex, variantIndex) => (productIndex * 31 + variantIndex * 17) % 40;

async function seedProducts(categoryIds) {
    for (const [productIndex, product] of PRODUCTS.entries()) {
        const categoryId = categoryIds[product.category];

        if (!categoryId) {
            throw new Error(`Unknown category "${product.category}" for ${product.name}`);
        }

        const slug = slugify(`${product.brand} ${product.name}`);
        const images = product.images.map((id, position) => ({
            url: IMG(id),
            altText: product.name,
            position,
        }));

        const data = {
            categoryId,
            name: product.name,
            description: product.description,
            brand: product.brand,
            price: product.price,
            originalPrice: product.originalPrice ?? null,
            isNew: product.isNew ?? false,
            isActive: true,
        };

        // ProductImage has no unique key, so images are replaced on every run.
        const saved = await prisma.product.upsert({
            where: { slug },
            update: { ...data, images: { deleteMany: {}, create: images } },
            create: { ...data, slug, images: { create: images } },
        });

        const combos = product.colors.flatMap((color) => product.sizes.map((size) => ({ color, size })));

        for (const [variantIndex, { color, size }] of combos.entries()) {
            const sku = [slug, color, size].filter(Boolean).join("-").toUpperCase();
            const variant = {
                productId: saved.id,
                size,
                color,
                colorHex: COLOR_HEX[color],
                stock: product.soldOut ? 0 : stockFor(productIndex, variantIndex),
                isActive: true,
            };

            await prisma.productVariant.upsert({
                where: { sku },
                update: variant,
                create: { ...variant, sku },
            });
        }
    }
}

async function main() {
    await seedUsers();
    const categoryIds = await seedCategories();
    await seedProducts(categoryIds);

    const [users, categories, products, variants, images] = await Promise.all([
        prisma.user.count(),
        prisma.category.count(),
        prisma.product.count(),
        prisma.productVariant.count(),
        prisma.productImage.count(),
    ]);

    console.log("Seed complete:", { users, categories, products, variants, images });
    console.log("Login: admin@example.com / Admin@12345, customer@example.com / Customer@12345");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
