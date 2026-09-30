import { matchedData } from "express-validator";

import {
    listAddresses,
    getAddress,
    createAddress,
    updateAddress,
    deleteAddress,
} from "../services/addressService.js";

// Only validated body fields reach the service (userId always comes from the token).

export async function getMyAddresses(req, res) {
    const data = await listAddresses(req.user.id);

    res.json({ success: true, data });
}

export async function getMyAddress(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getAddress(req.user.id, id);

    res.json({ success: true, data });
}

export async function createMyAddress(req, res) {
    const data = await createAddress(req.user.id, matchedData(req, { locations: ["body"] }));

    res.status(201).json({ success: true, data });
}

export async function updateMyAddress(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await updateAddress(req.user.id, id, matchedData(req, { locations: ["body"] }));

    res.json({ success: true, data });
}

export async function deleteMyAddress(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    await deleteAddress(req.user.id, id);

    res.json({ success: true, message: "Address deleted" });
}
