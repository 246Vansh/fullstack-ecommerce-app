import prisma from "../config/db.js";

const categoryFields = {
    id: true,
    name: true,
    slug: true,
    description: true,
    image: true,
};

// Top-level categories with their active subcategories.
export async function listCategories() {
    const categories = await prisma.category.findMany({
        where: { parentId: null, isActive: true },
        select: {
            ...categoryFields,
            children: {
                where: { isActive: true },
                select: categoryFields,
                orderBy: { name: "asc" },
            },
        },
        orderBy: { id: "asc" },
    });

    return categories.map(({ children, ...category }) => ({
        ...category,
        subcategories: children,
    }));
}
