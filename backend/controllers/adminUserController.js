import { matchedData } from "express-validator";

import * as users from "../services/adminUserService.js";

// Only validated fields reach the service (matchedData). The acting admin is
// always req.user, from the verified access token, never the request.
const params = (req) => matchedData(req, { locations: ["params"] });
const body = (req) => matchedData(req, { locations: ["body"] });

export async function listUsers(req, res) {
    const { data, pagination } = await users.listAdminUsers(matchedData(req, { locations: ["query"] }));

    res.json({ success: true, data, pagination });
}

export async function blockUser(req, res) {
    res.json({ success: true, data: await users.blockUser(req.user.id, params(req).id) });
}

export async function unblockUser(req, res) {
    res.json({ success: true, data: await users.unblockUser(req.user.id, params(req).id) });
}

export async function changeUserRole(req, res) {
    res.json({ success: true, data: await users.changeUserRole(req.user.id, params(req).id, body(req)) });
}
