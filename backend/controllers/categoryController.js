import { listCategories } from "../services/categoryService.js";

export async function getCategories(req, res) {
    const data = await listCategories();

    res.json({ success: true, data });
}
