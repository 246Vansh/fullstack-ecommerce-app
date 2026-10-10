import { matchedData } from "express-validator";

import { listProducts, getProductById, getProductsByIds } from "../services/productService.js";

export async function getProducts(req, res) {
    const query = matchedData(req, { locations: ["query"] });

    const { data, pagination } = await listProducts(query);

    res.json({ success: true, data, pagination });
}

export async function getProduct(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getProductById(id);

    res.json({ success: true, data });
}

export async function getProductsBatch(req, res) {
    const { ids } = matchedData(req, { locations: ["query"] });

    const data = await getProductsByIds(ids);

    res.json({ success: true, data });
}
