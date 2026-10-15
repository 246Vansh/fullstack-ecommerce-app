import { matchedData } from "express-validator";

import { listReviews, getOwnReview, createReview, updateReview, deleteReview } from "../services/reviewService.js";

// The product comes from the URL and the author from the token. Only the
// validated rating and body are read from the request body, so ids, author,
// timestamps or a client-supplied verifiedPurchase never reach the service.

export async function getReviews(req, res) {
    const { id, page, limit } = matchedData(req, { locations: ["params", "query"] });

    const { data, summary, pagination } = await listReviews(id, { page, limit });

    res.json({ success: true, data, summary, pagination });
}

export async function getMyReview(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getOwnReview(req.user.id, id);

    res.json({ success: true, data });
}

export async function createMyReview(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });
    const { rating, body } = matchedData(req, { locations: ["body"] });

    const data = await createReview(req.user.id, id, { rating, body });

    res.status(201).json({ success: true, data });
}

export async function updateMyReview(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });
    const { rating, body } = matchedData(req, { locations: ["body"] });

    const data = await updateReview(req.user.id, id, { rating, body });

    res.json({ success: true, data });
}

export async function deleteMyReview(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    await deleteReview(req.user.id, id);

    res.json({ success: true, message: "Review deleted" });
}
