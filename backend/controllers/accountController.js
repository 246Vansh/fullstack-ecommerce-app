import { matchedData } from "express-validator";

import { updateProfile, changePassword } from "../services/accountService.js";

// Only validated body fields reach the service (userId always comes from the token).

export async function updateMyProfile(req, res) {
    const user = await updateProfile(req.user.id, matchedData(req, { locations: ["body"] }));

    res.json({ success: true, user });
}

export async function changeMyPassword(req, res) {
    const { currentPassword, newPassword } = matchedData(req, { locations: ["body"] });

    await changePassword(req.user.id, { currentPassword, newPassword, sessionId: req.user.sessionId });

    res.json({ success: true, message: "Password updated. Other devices have been signed out." });
}
