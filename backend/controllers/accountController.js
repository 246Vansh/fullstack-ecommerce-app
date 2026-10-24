import { matchedData } from "express-validator";

import { updateProfile, changePassword, resendVerification, deleteAccount } from "../services/accountService.js";
import { listUserSessions, revokeUserSession, revokeAllUserSessions } from "../services/refreshTokenService.js";

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

export async function resendMyVerification(req, res) {
    await resendVerification(req.user.id);

    res.json({ success: true, message: "A new verification link is on its way. Check your inbox." });
}

export async function listMySessions(req, res) {
    const sessions = await listUserSessions(req.user.id, req.user.sessionId);

    res.json({ success: true, sessions });
}

export async function revokeMySession(req, res) {
    await revokeUserSession(req.user.id, req.params.sessionId);

    res.json({ success: true });
}

// Every session except the caller's own (all of them for a token without sid).
export async function revokeMyOtherSessions(req, res) {
    await revokeAllUserSessions(req.user.id, { exceptFamilyId: req.user.sessionId });

    res.json({ success: true });
}

export async function deleteMyAccount(req, res) {
    const { password } = matchedData(req, { locations: ["body"] });

    await deleteAccount(req.user.id, { password });

    res.json({ success: true, message: "Your account has been deleted." });
}
