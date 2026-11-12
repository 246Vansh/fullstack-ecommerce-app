import { matchedData } from "express-validator";

import * as coupons from "../services/couponService.js";

// Only validated fields reach the service (matchedData), and the service
// copies only the fields it allows.
const params = (req) => matchedData(req, { locations: ["params"] });
const body = (req) => matchedData(req, { locations: ["body"] });

export async function listCoupons(req, res) {
    const { data, pagination } = await coupons.listAdminCoupons(matchedData(req, { locations: ["query"] }));

    res.json({ success: true, data, pagination });
}

export async function getCoupon(req, res) {
    res.json({ success: true, data: await coupons.getAdminCoupon(params(req).id) });
}

export async function createCoupon(req, res) {
    res.status(201).json({ success: true, data: await coupons.createCoupon(body(req)) });
}

export async function updateCoupon(req, res) {
    res.json({ success: true, data: await coupons.updateCoupon(params(req).id, body(req)) });
}

export async function activateCoupon(req, res) {
    res.json({ success: true, data: await coupons.setCouponActive(params(req).id, true) });
}

export async function deactivateCoupon(req, res) {
    res.json({ success: true, data: await coupons.setCouponActive(params(req).id, false) });
}

export async function deleteCoupon(req, res) {
    res.json({ success: true, data: await coupons.deleteCoupon(params(req).id) });
}
