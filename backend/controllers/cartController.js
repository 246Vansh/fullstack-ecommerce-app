import { matchedData } from "express-validator";

import { getCart, addItem, updateItem, removeItem, clearCart } from "../services/cartService.js";

// Every handler returns the full, server-calculated cart.

export async function getMyCart(req, res) {
    const data = await getCart(req.user.id);

    res.json({ success: true, data });
}

export async function addCartItem(req, res) {
    const { variantId, quantity } = matchedData(req, { locations: ["body"] });

    const data = await addItem(req.user.id, { variantId, quantity });

    res.status(201).json({ success: true, data });
}

export async function updateCartItem(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });
    const { quantity } = matchedData(req, { locations: ["body"] });

    const data = await updateItem(req.user.id, id, { quantity });

    res.json({ success: true, data });
}

export async function removeCartItem(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await removeItem(req.user.id, id);

    res.json({ success: true, data });
}

export async function clearMyCart(req, res) {
    const data = await clearCart(req.user.id);

    res.json({ success: true, data });
}
