import { matchedData } from "express-validator";

import * as catalog from "../services/adminCatalogService.js";

// Only validated fields reach the service (matchedData), and the service
// copies only the fields it allows, so extra keys in a body are ignored.
const params = (req) => matchedData(req, { locations: ["params"] });
const body = (req) => matchedData(req, { locations: ["body"] });

export async function listProducts(req, res) {
    const { data, pagination } = await catalog.listAdminProducts(matchedData(req, { locations: ["query"] }));

    res.json({ success: true, data, pagination });
}

export async function getProduct(req, res) {
    res.json({ success: true, data: await catalog.getAdminProduct(params(req).id) });
}

export async function createProduct(req, res) {
    res.status(201).json({ success: true, data: await catalog.createProduct(body(req)) });
}

export async function updateProduct(req, res) {
    res.json({ success: true, data: await catalog.updateProduct(params(req).id, body(req)) });
}

export async function deactivateProduct(req, res) {
    res.json({ success: true, data: await catalog.deactivateProduct(params(req).id) });
}

export async function replaceImages(req, res) {
    res.json({ success: true, data: await catalog.replaceProductImages(params(req).id, body(req).images) });
}

export async function createVariant(req, res) {
    res.status(201).json({ success: true, data: await catalog.createVariant(params(req).id, body(req)) });
}

export async function updateVariant(req, res) {
    res.json({ success: true, data: await catalog.updateVariant(params(req).id, body(req)) });
}

export async function deactivateVariant(req, res) {
    res.json({ success: true, data: await catalog.deactivateVariant(params(req).id) });
}

export async function listCategories(req, res) {
    res.json({ success: true, data: await catalog.listAdminCategories() });
}

export async function createCategory(req, res) {
    res.status(201).json({ success: true, data: await catalog.createCategory(body(req)) });
}

export async function updateCategory(req, res) {
    res.json({ success: true, data: await catalog.updateCategory(params(req).id, body(req)) });
}
