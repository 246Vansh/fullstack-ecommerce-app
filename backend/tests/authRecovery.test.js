// Password reset, email verification, session management, logout everywhere,
// account deletion and the Origin check on /api/auth. Uses users this run
// creates (real bcrypt hashes at the app's cost), never a seeded account;
// after() deletes those users and their tokens. Emails come from the server's
// console mail provider (MAIL_PROVIDER=console), read from its output.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { startServer, login, post, refreshCookie } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const { guard, skip, prisma } = await openTestDatabase();

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
// SALT_ROUNDS in services/authService.js.
const SALT_ROUNDS = 12;
const PASSWORD = `Recov-${RUN}-Pass1`;
const NEW_PASSWORD = `Recov-${RUN}-Next2`;
const CLIENT_URL = process.env.CLIENT_URL;

const sha256 = (token) => crypto.createHash("sha256").update(token).digest("hex");
const emailFor = (key) => `recovery-${key}-${RUN}@example.test`;

let server;
const users = {};

async function send(method, path, { token, body, headers = {} } = {}) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, res };
}

async function signIn(email, password = PASSWORD) {
    const { res, body, token } = await login(server.url, { email, password });
    assert.equal(res.status, 200, `login as ${email}`);
    return { accessToken: body.accessToken, refresh: token, user: body.user };
}

const refresh = (cookie) => post(`${server.url}/auth/refresh`, undefined, { cookie });

// The token in the newest console email to `email` linking to `path`. The
// email is sent after the response, so this waits for it to appear.
async function mailedToken(email, path, { after = 0 } = {}) {
    for (let i = 0; i < 50; i++) {
        const blocks = server.output().split("[mail:console] To: ").slice(1)
            .filter((block) => block.startsWith(email));
        if (blocks.length > after) {
            const match = blocks.at(-1).match(new RegExp(`${path}\\?token=([A-Za-z0-9_%-]+)`));
            return match && decodeURIComponent(match[1]);
        }
        await new Promise((ok) => setTimeout(ok, 50));
    }
    return null;
}

const mailCount = (email) => server.output().split("[mail:console] To: ").slice(1)
    .filter((block) => block.startsWith(email)).length;

const createUser = async (key, { role = "CUSTOMER", verified = false } = {}) => {
    users[key] = await prisma.user.create({
        data: {
            email: emailFor(key),
            passwordHash: await bcrypt.hash(PASSWORD, SALT_ROUNDS),
            firstName: "Recovery",
            lastName: key,
            role,
            emailVerifiedAt: verified ? new Date() : null,
        },
    });
};

// A token row written directly (bypasses the one-per-minute send limit).
async function plantToken(userId, purpose, { expiresInMs = 30 * 60 * 1000 } = {}) {
    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.userToken.create({
        data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + expiresInMs) },
    });
    return token;
}

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    for (const key of ["reset", "expired", "race", "sessions", "other", "logoutall", "delete"]) await createUser(key);
    await createUser("verified", { verified: true });
    await createUser("admin", { role: "ADMIN" });

    server = await startServer({ ...testServerEnv(guard), MAIL_PROVIDER: "console" });
});

after(async () => {
    if (!guard.ok) return;

    try {
        const created = Object.values(users);

        if (created.length) {
            await deleteInTestDatabase(prisma, async (tx) => {
                const ids = created.map((u) => u.id);
                await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } });
                await tx.userToken.deleteMany({ where: { userId: { in: ids } } });
                await tx.address.deleteMany({ where: { userId: { in: ids } } });
                await tx.cart.deleteMany({ where: { userId: { in: ids } } });
                // Deleted accounts have a replaced email, so match by id only.
                expectDeleted("users", await tx.user.deleteMany({ where: { id: { in: ids } } }), created.length);
            });
        }
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ---------- Forgot / reset password ----------

dbTest("forgot password: same response for known and unknown emails", async () => {
    const unknown = await send("POST", "/auth/forgot-password", { body: { email: `nobody-${RUN}@example.test` } });
    const known = await send("POST", "/auth/forgot-password", { body: { email: emailFor("reset") } });

    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    assert.deepEqual(unknown.body, known.body, "identical bodies");
    assert.equal(await mailedToken(`nobody-${RUN}@example.test`, "/reset-password", { after: 0 }), null, "no email for unknown");

    const token = await mailedToken(emailFor("reset"), "/reset-password");
    assert.ok(token, "reset link emailed");
    assert.ok(server.output().includes(`${CLIENT_URL}/reset-password?token=`), "link points at CLIENT_URL");

    const row = await prisma.userToken.findUnique({ where: { tokenHash: sha256(token) } });
    assert.equal(row.userId, users.reset.id);
    assert.equal(row.purpose, "PASSWORD_RESET");
    assert.equal(row.usedAt, null);
    assert.ok(row.expiresAt - Date.now() <= 30 * 60 * 1000 && row.expiresAt - Date.now() > 25 * 60 * 1000, "~30 minute lifetime");
    assert.equal(JSON.stringify(known.body).includes(token), false, "token never in the response");

    // A second request within a minute sends nothing new.
    const before = mailCount(emailFor("reset"));
    assert.equal((await send("POST", "/auth/forgot-password", { body: { email: emailFor("reset") } })).status, 200);
    await new Promise((ok) => setTimeout(ok, 300));
    assert.equal(mailCount(emailFor("reset")), before, "no second email within a minute");
    assert.equal(await prisma.userToken.count({ where: { userId: users.reset.id } }), 1);
});

dbTest("reset password: sets the password, revokes every session, single use", async () => {
    const session = await signIn(emailFor("reset"));
    const token = await mailedToken(emailFor("reset"), "/reset-password");

    const bad = await send("POST", "/auth/reset-password", { body: { token: "not-a-real-token", password: NEW_PASSWORD } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.details[0].field, "token");

    const weak = await send("POST", "/auth/reset-password", { body: { token, password: "short" } });
    assert.equal(weak.status, 422, "password rule applies");

    const ok = await send("POST", "/auth/reset-password", { body: { token, password: NEW_PASSWORD } });
    assert.equal(ok.status, 200);
    assert.equal(refreshCookie(ok.res), "", "refresh cookie cleared");

    assert.equal((await refresh(session.refresh)).status, 401, "existing session revoked");
    assert.equal((await login(server.url, { email: emailFor("reset"), password: PASSWORD })).res.status, 401, "old password rejected");
    await signIn(emailFor("reset"), NEW_PASSWORD);

    const user = await prisma.user.findUnique({ where: { id: users.reset.id } });
    assert.ok(user.emailVerifiedAt, "reset link verifies the email");

    const again = await send("POST", "/auth/reset-password", { body: { token, password: `${NEW_PASSWORD}x` } });
    assert.equal(again.status, 400, "token is single use");
});

dbTest("reset password: expired and wrong-purpose tokens are rejected", async () => {
    const expired = await plantToken(users.expired.id, "PASSWORD_RESET", { expiresInMs: -1000 });
    const verification = await plantToken(users.expired.id, "EMAIL_VERIFICATION");

    for (const token of [expired, verification]) {
        const res = await send("POST", "/auth/reset-password", { body: { token, password: NEW_PASSWORD } });
        assert.equal(res.status, 400);
    }

    await signIn(emailFor("expired"), PASSWORD);
});

dbTest("reset password: two concurrent requests with one token, exactly one succeeds", async () => {
    const token = await plantToken(users.race.id, "PASSWORD_RESET");

    const results = await Promise.all([
        send("POST", "/auth/reset-password", { body: { token, password: NEW_PASSWORD } }),
        send("POST", "/auth/reset-password", { body: { token, password: `${NEW_PASSWORD}b` } }),
    ]);

    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});

// ---------- Email verification ----------

dbTest("email verification: registration emails a link that verifies once", async () => {
    const email = emailFor("registered");
    const reg = await send("POST", "/auth/register", {
        body: { firstName: "New", lastName: "Customer", email, password: PASSWORD },
    });
    assert.equal(reg.status, 201);
    users.registered = reg.body.user;
    assert.equal(reg.body.user.emailVerifiedAt, null);

    const token = await mailedToken(email, "/verify-email");
    assert.ok(token, "verification link emailed");

    const ok = await send("POST", "/auth/verify-email", { body: { token } });
    assert.equal(ok.status, 200);
    assert.ok((await prisma.user.findUnique({ where: { id: reg.body.user.id } })).emailVerifiedAt);

    assert.equal((await send("POST", "/auth/verify-email", { body: { token } })).status, 400, "single use");
    assert.equal((await send("POST", "/auth/verify-email", { body: {} })).status, 422);

    const { accessToken } = await signIn(email);
    const resend = await send("POST", "/account/verification-email", { token: accessToken });
    assert.equal(resend.status, 409, "already verified");
});

dbTest("email verification: a verified user cannot resend; guests get 401", async () => {
    const { accessToken } = await signIn(emailFor("verified"));
    assert.equal((await send("POST", "/account/verification-email", { token: accessToken })).status, 409);
    assert.equal((await send("POST", "/account/verification-email")).status, 401);
});

// ---------- Sessions ----------

dbTest("sessions: lists own sessions, revokes one, revokes all others", async () => {
    const a = await signIn(emailFor("sessions"));
    const b = await signIn(emailFor("sessions"));
    const c = await signIn(emailFor("sessions"));
    const stranger = await signIn(emailFor("other"));

    const list = await send("GET", "/account/sessions", { token: a.accessToken });
    assert.equal(list.status, 200);
    assert.equal(list.body.sessions.length, 3);
    assert.equal(list.body.sessions.filter((s) => s.current).length, 1);
    for (const s of list.body.sessions) {
        assert.deepEqual(Object.keys(s).sort(), ["current", "expiresAt", "id", "lastActiveAt", "persistent", "sessionExpiresAt", "signedInAt"]);
    }
    const ownId = list.body.sessions.find((s) => s.current).id;

    const bId = (await send("GET", "/account/sessions", { token: b.accessToken })).body.sessions.find((s) => s.current).id;
    assert.notEqual(bId, ownId);

    // Another user's session id is "not found" and stays active.
    const strangerId = (await send("GET", "/account/sessions", { token: stranger.accessToken })).body.sessions[0].id;
    assert.equal((await send("DELETE", `/account/sessions/${strangerId}`, { token: a.accessToken })).status, 404);
    assert.equal((await refresh(stranger.refresh)).status, 200, "stranger's session untouched");

    assert.equal((await send("DELETE", "/account/sessions/not-a-uuid", { token: a.accessToken })).status, 422);
    assert.equal((await send("DELETE", `/account/sessions/${bId}`, { token: a.accessToken })).status, 200);
    assert.equal((await refresh(b.refresh)).status, 401, "revoked session cannot refresh");

    assert.equal((await send("DELETE", "/account/sessions", { token: a.accessToken })).status, 200);
    assert.equal((await refresh(c.refresh)).status, 401, "other session revoked");
    assert.equal((await refresh(a.refresh)).status, 200, "own session kept");

    assert.equal((await send("GET", "/account/sessions")).status, 401);
});

dbTest("logout-all: every session of the cookie's user ends; stale cookies are ignored", async () => {
    const a = await signIn(emailFor("logoutall"));
    const b = await signIn(emailFor("logoutall"));

    // A rotated (stale) token signs nobody out, and the call still succeeds.
    const bNext = refreshCookie(await refresh(b.refresh));
    assert.equal((await post(`${server.url}/auth/logout-all`, undefined, { cookie: b.refresh })).status, 200);
    assert.equal(await prisma.refreshToken.count({ where: { userId: users.logoutall.id, revokedAt: null } }), 2,
        "a stale cookie ended no session");

    const a2 = { refresh: refreshCookie(await refresh(a.refresh)) };
    const res = await post(`${server.url}/auth/logout-all`, undefined, { cookie: a2.refresh });
    assert.equal(res.status, 200);
    assert.equal(refreshCookie(res), "", "cookie cleared");
    assert.equal(await prisma.refreshToken.count({ where: { userId: users.logoutall.id, revokedAt: null } }), 0);
    assert.equal((await refresh(bNext)).status, 401);
});

// ---------- Account deletion ----------

dbTest("delete account: needs the password, anonymises the user, ends sessions", async () => {
    const session = await signIn(emailFor("delete"));
    await prisma.address.create({
        data: {
            userId: users.delete.id, firstName: "A", lastName: "B", phone: "9999999999", address: "1 Road",
            city: "City", state: "State", zipCode: "123456", country: "India",
        },
    });

    const wrong = await send("DELETE", "/account", { token: session.accessToken, body: { password: "wrong-password" } });
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.details[0].field, "password");
    assert.equal((await send("DELETE", "/account", { token: session.accessToken, body: {} })).status, 422);

    const ok = await send("DELETE", "/account", { token: session.accessToken, body: { password: PASSWORD } });
    assert.equal(ok.status, 200);

    const user = await prisma.user.findUnique({ where: { id: users.delete.id } });
    assert.match(user.email, /^deleted-\d+-[0-9a-f]+@deleted\.invalid$/);
    assert.equal(user.firstName, "Deleted");
    assert.equal(user.phone, null);
    assert.equal(await prisma.address.count({ where: { userId: users.delete.id } }), 0);
    assert.equal(await prisma.refreshToken.count({ where: { userId: users.delete.id } }), 0);

    assert.equal((await refresh(session.refresh)).status, 401);
    assert.equal((await login(server.url, { email: emailFor("delete"), password: PASSWORD })).res.status, 401);
});

dbTest("delete account: admins are refused", async () => {
    const { accessToken } = await signIn(emailFor("admin"));
    const res = await send("DELETE", "/account", { token: accessToken, body: { password: PASSWORD } });
    assert.equal(res.status, 403);
    assert.equal((await prisma.user.findUnique({ where: { id: users.admin.id } })).email, emailFor("admin"));
});

// ---------- Origin check (CSRF) ----------

dbTest("auth routes refuse a foreign Origin, accept CLIENT_URL and no Origin", async () => {
    const foreign = await send("POST", "/auth/refresh", { headers: { Origin: "https://evil.example" } });
    assert.equal(foreign.status, 403);
    assert.equal((await send("POST", "/auth/logout", { headers: { Origin: "null" } })).status, 403);
    assert.equal((await send("POST", "/auth/login", {
        headers: { Origin: "https://evil.example" }, body: { email: emailFor("other"), password: PASSWORD },
    })).status, 403, "login CSRF refused");

    assert.equal((await send("POST", "/auth/refresh", { headers: { Origin: CLIENT_URL } })).status, 401, "allowed through (no cookie)");
    assert.equal((await send("POST", "/auth/refresh")).status, 401, "no Origin passes");
});

// ---------- Rate limit ----------

dbTest("forgot password is rate limited per IP (5 per 15 minutes)", async () => {
    const limited = await startServer({ ...testServerEnv(guard), MAIL_PROVIDER: "disabled" });
    try {
        const statuses = [];
        for (let i = 0; i < 6; i++) {
            const res = await post(`${limited.url}/auth/forgot-password`, { email: `nobody-${RUN}-${i}@example.test` });
            statuses.push(res.status);
        }
        assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
    } finally {
        await limited.stop();
    }
});
