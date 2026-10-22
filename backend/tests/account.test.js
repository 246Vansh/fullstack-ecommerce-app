// Account settings: profile update and password change, including which
// refresh-token sessions a password change revokes. Uses customers this run
// creates (real bcrypt hashes at the app's cost), never a seeded account;
// after() deletes those users and their refresh tokens.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";

import { newPasswordRule } from "../middleware/validate.js";
import { startServer, login, post, refreshCookie } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const { guard, skip, prisma } = await openTestDatabase();
const { signAccessToken } = guard.ok ? await import("../utils/jwt.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
// SALT_ROUNDS in services/authService.js.
const SALT_ROUNDS = 12;
const PASSWORD = `Acct-${RUN}-Pass1`;
const NEW_PASSWORD = `Acct-${RUN}-Next2`;

const sha256 = (token) => crypto.createHash("sha256").update(token).digest("hex");
const row = (token) => prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });

let server;
const users = {};
const bodies = [];

async function send(method, path, { token, body } = {}) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    bodies.push(text);
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

const patchProfile = (token, body) => send("PATCH", "/account/profile", { token, body });
const changePassword = (token, body) => send("POST", "/account/password", { token, body });

// One login: { accessToken, refresh (cookie token) }.
async function signIn(user, password = PASSWORD, extra) {
    const { res, body, token } = await login(server.url, { email: user.email, password }, extra);
    bodies.push(JSON.stringify(body));
    assert.equal(res.status, 200, `login as ${user.email}`);
    return { accessToken: body.accessToken, refresh: token };
}

const createUser = async (key) => {
    users[key] = await prisma.user.create({
        data: {
            email: `phase1-account-${key}-${RUN}@example.test`,
            passwordHash: await bcrypt.hash(PASSWORD, SALT_ROUNDS),
            firstName: "Test",
            lastName: "Account",
            role: "CUSTOMER",
        },
    });
};

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    // Separate users so the per-user password limiter (5 per 15 min) in one
    // test never blocks another.
    for (const key of ["profile", "invalid", "change", "nosid", "limit", "bounds"]) await createUser(key);

    server = await startServer(testServerEnv(guard));
});

after(async () => {
    if (!guard.ok) return;

    try {
        const created = Object.values(users);

        if (created.length) {
            await deleteInTestDatabase(prisma, async (tx) => {
                const ids = created.map((u) => u.id);
                await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } });
                expectDeleted("users", await tx.user.deleteMany({
                    where: { id: { in: ids }, email: { in: created.map((u) => u.email) } },
                }), created.length);
            });
        }
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ---------- Shared password rule (no database) ----------

// The one rule registration and password change both use (middleware/validate.js).
test("new-password rule: at least 8 characters and at most 72 UTF-8 bytes", async () => {
    const accepts = async (password) => {
        const req = { body: { password } };
        await newPasswordRule("password").run(req);
        return validationResult(req).isEmpty();
    };

    assert.equal(await accepts("é".repeat(35) + "a"), true, "71 bytes");
    assert.equal(await accepts("é".repeat(36)), true, "72 bytes");
    assert.equal(await accepts("é".repeat(37)), false, "74 bytes (37 characters)");
    assert.equal(await accepts("😀".repeat(18)), true, "72 bytes of 4-byte emoji");
    assert.equal(await accepts("😀".repeat(19)), false, "76 bytes of 4-byte emoji");
    assert.equal(await accepts("a".repeat(72)), true, "72 ASCII characters");
    assert.equal(await accepts("a".repeat(73)), false, "73 ASCII characters");
    assert.equal(await accepts("1234567"), false, "7 characters");
    assert.equal(await accepts(12345678), false, "not a string");
});

// ---------- Profile ----------

dbTest("profile: updates first name, last name and phone", async () => {
    const { accessToken } = await signIn(users.profile);

    const res = await patchProfile(accessToken, { firstName: "  Asha ", lastName: "Rao", phone: "+91 98765 43210" });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.firstName, "Asha", "trimmed");
    assert.equal(res.body.user.lastName, "Rao");
    assert.equal(res.body.user.phone, "+91 98765 43210");
    assert.equal(res.body.user.email, users.profile.email);
    assert.equal(res.body.user.passwordHash, undefined);

    const stored = await prisma.user.findUnique({ where: { id: users.profile.id } });
    assert.equal(stored.firstName, "Asha");
    assert.equal(stored.phone, "+91 98765 43210");

    // A partial update leaves other fields alone; an empty phone clears it.
    const partial = await patchProfile(accessToken, { phone: "" });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.user.phone, null);
    assert.equal(partial.body.user.firstName, "Asha");
});

dbTest("profile: invalid fields give 422 with the field named", async () => {
    const { accessToken } = await signIn(users.profile);

    const cases = [
        [{ firstName: "   " }, "firstName"],
        [{ lastName: "x".repeat(101) }, "lastName"],
        [{ firstName: 42 }, "firstName"],
        [{ phone: "call me" }, "phone"],
        [{ phone: "1".repeat(31) }, "phone"],
    ];

    for (const [body, field] of cases) {
        const res = await patchProfile(accessToken, body);
        assert.equal(res.status, 422, JSON.stringify(body));
        assert.equal(res.body.details[0].field, field, JSON.stringify(body));
    }

    const empty = await patchProfile(accessToken, {});
    assert.equal(empty.status, 422);

    const stored = await prisma.user.findUnique({ where: { id: users.profile.id } });
    assert.equal(stored.firstName, "Asha", "nothing was written");
});

dbTest("profile: role, email, verification and password hash cannot be changed", async () => {
    const { accessToken } = await signIn(users.profile);
    const before = await prisma.user.findUnique({ where: { id: users.profile.id } });

    const res = await patchProfile(accessToken, {
        firstName: "Escalate",
        role: "ADMIN",
        email: `attacker-${RUN}@example.test`,
        emailVerifiedAt: new Date().toISOString(),
        passwordHash: "$2b$12$attackerattackerattackerattackerattackerattackerat",
        id: 1,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "CUSTOMER");

    const stored = await prisma.user.findUnique({ where: { id: users.profile.id } });
    assert.equal(stored.firstName, "Escalate");
    assert.equal(stored.role, "CUSTOMER");
    assert.equal(stored.email, before.email);
    assert.equal(stored.emailVerifiedAt, null);
    assert.equal(stored.passwordHash, before.passwordHash);

    // Only forbidden fields: nothing to update.
    const onlyRole = await patchProfile(accessToken, { role: "ADMIN" });
    assert.equal(onlyRole.status, 422);
    assert.equal((await prisma.user.findUnique({ where: { id: users.profile.id } })).role, "CUSTOMER");
});

dbTest("unauthenticated or invalid tokens get 401 on both routes", async () => {
    const { refresh } = await signIn(users.profile);
    const forged = jwt.sign({ sub: String(users.profile.id), role: "CUSTOMER", type: "access" }, "not-the-real-secret-not-the-real-secret");
    const expired = jwt.sign(
        { sub: String(users.profile.id), role: "CUSTOMER", type: "access", exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_ACCESS_SECRET,
    );

    for (const [name, token] of Object.entries({ none: undefined, forged, expired, refreshAsAccess: refresh, garbage: "abc" })) {
        assert.equal((await patchProfile(token, { firstName: "Nope" })).status, 401, `profile: ${name}`);
        assert.equal((await changePassword(token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).status, 401, `password: ${name}`);
    }

    assert.notEqual((await prisma.user.findUnique({ where: { id: users.profile.id } })).firstName, "Nope");
});

// ---------- Password ----------

dbTest("password: wrong current password and invalid new passwords are rejected, nothing revoked", async () => {
    const current = await signIn(users.invalid);
    const other = await signIn(users.invalid);
    const before = await prisma.user.findUnique({ where: { id: users.invalid.id } });

    const wrong = await changePassword(current.accessToken, { currentPassword: "Wrong-Pass-123", newPassword: NEW_PASSWORD });
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.details[0].field, "currentPassword");

    const cases = [
        [{ newPassword: NEW_PASSWORD }, "currentPassword"],
        [{ currentPassword: PASSWORD, newPassword: "short" }, "newPassword"],
        // 37 characters but 74 UTF-8 bytes: over bcrypt's 72-byte limit.
        [{ currentPassword: PASSWORD, newPassword: "é".repeat(37) }, "newPassword"],
        [{ currentPassword: PASSWORD, newPassword: PASSWORD }, "newPassword"],
    ];

    for (const [body, field] of cases) {
        const res = await changePassword(current.accessToken, body);
        assert.equal(res.status, 422, JSON.stringify(body));
        assert.equal(res.body.details[0].field, field, JSON.stringify(body));
    }

    const stored = await prisma.user.findUnique({ where: { id: users.invalid.id } });
    assert.equal(stored.passwordHash, before.passwordHash, "hash unchanged");
    assert.equal((await row(current.refresh)).revokedAt, null);
    assert.equal((await row(other.refresh)).revokedAt, null, "other sessions not revoked");
});

dbTest("password: an oversized current password is rejected by validation, before bcrypt", async () => {
    const { accessToken } = await signIn(users.bounds);
    const before = await prisma.user.findUnique({ where: { id: users.bounds.id } });

    const res = await changePassword(accessToken, { currentPassword: "x".repeat(1025), newPassword: NEW_PASSWORD });

    // The validator's message, not "Current password is incorrect" from comparing it.
    assert.equal(res.status, 422);
    assert.equal(res.body.details[0].field, "currentPassword");
    assert.match(res.body.details[0].message, /too long/i);
    assert.equal((await prisma.user.findUnique({ where: { id: users.bounds.id } })).passwordHash, before.passwordHash);
});

dbTest("password: change revokes other sessions, keeps the current one, old password stops working", async () => {
    const current = await signIn(users.change);
    const otherTab = await signIn(users.change);
    const remembered = await signIn(users.change, PASSWORD, { remember: true });

    // The current session's access token names its family.
    const { sid } = jwt.decode(current.accessToken);
    assert.equal(sid, (await row(current.refresh)).familyId);

    // A 72-byte multibyte password (36 × "é") is accepted: the limit is bytes.
    const newPassword = "é".repeat(36);
    const res = await changePassword(current.accessToken, { currentPassword: PASSWORD, newPassword });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const stored = await prisma.user.findUnique({ where: { id: users.change.id } });
    assert.equal(bcrypt.getRounds(stored.passwordHash), SALT_ROUNDS);
    assert.ok(await bcrypt.compare(newPassword, stored.passwordHash));

    for (const session of [otherTab, remembered]) {
        assert.equal((await row(session.refresh)).revokedReason, "LOGOUT");
        assert.equal((await post(`${server.url}/auth/refresh`, undefined, { cookie: session.refresh })).status, 401);
    }

    assert.equal((await row(current.refresh)).revokedAt, null, "current session kept");
    const rotated = await post(`${server.url}/auth/refresh`, undefined, { cookie: current.refresh });
    assert.equal(rotated.status, 200, "current session still refreshes");
    const rotatedBody = await rotated.json();
    bodies.push(JSON.stringify(rotatedBody));
    assert.equal(jwt.decode(rotatedBody.accessToken).sid, sid, "refreshed access token keeps the session id");

    const oldLogin = await post(`${server.url}/auth/login`, { email: users.change.email, password: PASSWORD });
    assert.equal(oldLogin.status, 401, "old password rejected");
    assert.equal(refreshCookie(oldLogin), null);

    await signIn(users.change, newPassword);
});

dbTest("password: a token without a session id revokes every session", async () => {
    const a = await signIn(users.nosid);
    const b = await signIn(users.nosid);

    // Access tokens issued before this change carried no sid.
    const legacy = signAccessToken({ id: users.nosid.id, role: "CUSTOMER" });
    const res = await changePassword(legacy, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(res.status, 200);

    assert.equal((await row(a.refresh)).revokedReason, "LOGOUT");
    assert.equal((await row(b.refresh)).revokedReason, "LOGOUT");
});

dbTest("password: attempts are limited per user", async () => {
    const { accessToken } = await signIn(users.limit);
    const attempt = () => changePassword(accessToken, { currentPassword: "Wrong-Pass-123", newPassword: NEW_PASSWORD });

    for (let i = 0; i < 5; i++) assert.equal((await attempt()).status, 422);
    assert.equal((await attempt()).status, 429);

    // Another user's budget is separate.
    const other = await signIn(users.profile);
    assert.equal((await patchProfile(other.accessToken, { lastName: "Unaffected" })).status, 200);
});

dbTest("no password hashes, passwords or secrets in responses or server output", async () => {
    const output = server.output();
    const secrets = [process.env.JWT_ACCESS_SECRET, process.env.JWT_REFRESH_SECRET, PASSWORD, NEW_PASSWORD, "é".repeat(36)];

    for (const secret of secrets) {
        assert.ok(!output.includes(secret), "server output contains a secret");
        assert.ok(!bodies.some((b) => b.includes(secret)), "a response body contains a secret");
    }

    assert.ok(!bodies.some((b) => /passwordHash|tokenHash|\$2[aby]\$/.test(b)));
});
