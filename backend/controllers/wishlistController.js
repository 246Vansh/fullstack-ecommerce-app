import { matchedData } from "express-validator";

import { addToWishlist, listWishlist, removeFromWishlist } from "../services/wishlistService.js";

// The owner always comes from the token; the request only names the product.

export async function getMyWishlist(req, res) {
    res.json({ success: true, data: await listWishlist(req.user.id) });
}

// 201 when the product was added, 200 when it was already saved.
export async function addToMyWishlist(req, res) {
    const { productId } = matchedData(req, { locations: ["params"] });

    const data = await addToWishlist(req.user.id, productId);

    res.status(data.added ? 201 : 200).json({ success: true, data });
}

// 200 whether or not the product was saved, so a repeat is harmless.
export async function removeFromMyWishlist(req, res) {
    const { productId } = matchedData(req, { locations: ["params"] });

    res.json({ success: true, data: await removeFromWishlist(req.user.id, productId) });
}
