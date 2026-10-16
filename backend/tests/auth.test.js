// Login, refresh rotation, reuse detection, logout and secret hygiene. Logs in
// as a customer this run creates (a real bcrypt hash at the app's cost), never
// a seeded account; after() deletes that user and its refresh tokens.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { startServer, login, post, refreshCookie, setCookieHeader } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { loginUser } = guard.ok ? await import("../services/authService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
// SALT_ROUNDS in services/authService.js: the timing test compares this hash
// against the app's dummy hash, so both must cost the same.
const SALT_ROUNDS = 12;
const USER = { email: `phase6-auth-${RUN}@example.test`, password: `Auth-${RUN}-Pass1` };

const sha256 = (token) => crypto.createHash("sha256").update(token).digest("hex");
const row = (token) => prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });

let server, user;
const issuedTokens = [];
const bodies = [];

const track = async (res) => {
    const text = await res.clone().text();
    bodies.push(text);
    const token = refreshCookie(res);
    if (token) issuedTokens.push(token);
    return res;
};

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    user = await prisma.user.create({
        data: { email: USER.email, passwordHash: await bcrypt.hash(USER.password, SALT_ROUNDS), firstName: "Test", lastName: "Auth", role: "CUSTOMER" },
    });

    server = await startServer(testServerEnv(guard));

    // The server can log in a user that exists only in this run (a wrong
    // database would answer 401 and write nothing).
    const probe = await track(await post(`${server.url}/auth/login`, USER));
    assert.equal(probe.status, 200, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's user and its refresh tokens (carts cascade with it).
        if (user) {
            await deleteInTestDatabase(prisma, async (tx) => {
                await tx.refreshToken.deleteMany({ where: { userId: user.id } });
                expectDeleted("users", await tx.user.deleteMany({ where: { id: user.id, email: USER.email } }), 1);
            });
        }
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

dbTest("1. login with valid credentials", async () => {
    const res = await track(await post(`${server.url}/auth/login`, USER));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.user.email, USER.email);
    assert.ok(body.accessToken);
    assert.equal(body.user.passwordHash, undefined);

    const cookie = setCookieHeader(res);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\/api\/auth/);
    assert.doesNotMatch(cookie, /Max-Age|Expires/i, "remember=false gives a browser-session cookie");

    const stored = await row(refreshCookie(res));
    assert.ok(stored, "refresh token is stored server-side");
    assert.equal(stored.tokenHash.length, 64);
    assert.notEqual(stored.tokenHash, refreshCookie(res));
    assert.equal(stored.revokedAt, null);
});

dbTest("2/3. wrong password and unknown email fail identically", async () => {
    const wrong = await track(await post(`${server.url}/auth/login`, { email: USER.email, password: "Wrong-Pass-123" }));
    const unknown = await track(await post(`${server.url}/auth/login`, { email: "nobody-phase6@example.com", password: "Wrong-Pass-123" }));

    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await wrong.json(), await unknown.json());
    assert.equal(refreshCookie(wrong), null);
    assert.equal(refreshCookie(unknown), null);
});

dbTest("3. unknown email does the same bcrypt work as a wrong password", async () => {
    const time = async (email) => {
        const start = process.hrtime.bigint();
        await loginUser({ email, password: "Wrong-Pass-123" }).catch(() => {});
        return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];

    const wrong = [], unknown = [];
    for (let i = 0; i < 5; i++) {
        wrong.push(await time(USER.email));
        unknown.push(await time(`nobody-${i}@example.com`));
    }

    const [w, u] = [median(wrong), median(unknown)];
    console.log(`    median wrong-password ${w.toFixed(0)}ms, unknown-email ${u.toFixed(0)}ms`);
    // Without the dummy hash the unknown path skips bcrypt (~1ms vs ~200ms).
    assert.ok(u > w * 0.6 && u < w * 1.6, `timings differ: wrong ${w}ms vs unknown ${u}ms`);
});

dbTest("4. refresh rotates the token and revokes the old one", async () => {
    const { token } = await login(server.url, USER);
    issuedTokens.push(token);

    const res = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: token }));
    const body = await res.json();
    const next = refreshCookie(res);

    assert.equal(res.status, 200);
    assert.ok(body.accessToken);
    assert.equal(body.refreshToken, undefined, "refresh token is never in the body");
    assert.ok(next && next !== token, "a new refresh token is issued");

    const [oldRow, newRow] = [await row(token), await row(next)];
    assert.equal(oldRow.revokedReason, "ROTATED");
    assert.ok(oldRow.revokedAt);
    assert.equal(newRow.revokedAt, null);
    assert.equal(newRow.familyId, oldRow.familyId, "same session family");
});

dbTest("4b. remember=true keeps a persistent cookie across rotation", async () => {
    const { token, res } = await login(server.url, USER, { remember: true });
    issuedTokens.push(token);
    assert.match(setCookieHeader(res), /Max-Age|Expires/i);

    const rotated = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: token }));
    assert.equal(rotated.status, 200);
    assert.match(setCookieHeader(rotated), /Max-Age|Expires/i);
});

dbTest("5. reusing an old token after the grace window revokes the session", async () => {
    const { token: first } = await login(server.url, USER);
    const second = refreshCookie(await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: first })));
    issuedTokens.push(first);

    // Simulate the rotation having happened a minute ago (outside the 10s grace).
    await prisma.refreshToken.update({
        where: { tokenHash: sha256(first) },
        data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const reuse = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: first }));
    assert.equal(reuse.status, 401);
    assert.match(setCookieHeader(reuse), /refreshToken=;/, "cookie cleared");

    const afterReuse = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: second }));
    assert.equal(afterReuse.status, 401, "the newer token of the same session is revoked too");
    assert.equal((await row(second)).revokedReason, "REUSE");
    assert.match(server.output(), /Refresh token reuse detected/);
});

dbTest("5b. concurrent refreshes with the same token (two tabs) both succeed", async () => {
    const { token } = await login(server.url, USER);
    issuedTokens.push(token);

    const [a, b] = await Promise.all([
        post(`${server.url}/auth/refresh`, undefined, { cookie: token }),
        post(`${server.url}/auth/refresh`, undefined, { cookie: token }),
    ]);
    await track(a); await track(b);

    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.notEqual(refreshCookie(a), refreshCookie(b));
});

dbTest("6. logout revokes the refresh session", async () => {
    const { token } = await login(server.url, USER);
    const rotated = refreshCookie(await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: token })));

    const res = await track(await post(`${server.url}/auth/logout`, undefined, { cookie: rotated }));
    assert.equal(res.status, 200);
    assert.match(setCookieHeader(res), /refreshToken=;/);
    assert.equal((await row(rotated)).revokedReason, "LOGOUT");

    const again = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: rotated }));
    assert.equal(again.status, 401);

    // Logging out with no cookie, or a garbage one, still succeeds.
    assert.equal((await post(`${server.url}/auth/logout`)).status, 200);
    assert.equal((await post(`${server.url}/auth/logout`, undefined, { cookie: "garbage" })).status, 200);
});

dbTest("7. expired, forged, revoked or missing tokens give a clean 401", async () => {
    const expired = jwt.sign(
        { sub: String(user.id), type: "refresh", fam: crypto.randomUUID(), jti: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_REFRESH_SECRET,
    );
    const forged = jwt.sign({ sub: String(user.id), type: "refresh" }, "not-the-real-secret-not-the-real-secret");
    // Validly signed, but never issued by the server (no row): rejected.
    const unknown = jwt.sign({ sub: String(user.id), type: "refresh", fam: "x", jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });
    const accessAsRefresh = jwt.sign({ sub: String(user.id), type: "access" }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });

    for (const [name, token] of Object.entries({ expired, forged, unknown, accessAsRefresh, garbage: "abc" })) {
        const res = await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: token }));
        assert.equal(res.status, 401, name);
        assert.match(setCookieHeader(res), /refreshToken=;/, `${name}: cookie cleared`);
    }

    const none = await track(await post(`${server.url}/auth/refresh`));
    assert.equal(none.status, 401);
});

dbTest("15. no secrets in responses or server output", async () => {
    const output = server.output();
    const secrets = [process.env.JWT_ACCESS_SECRET, process.env.JWT_REFRESH_SECRET, USER.password, new URL(process.env.DATABASE_URL).password];

    for (const secret of secrets) {
        assert.ok(!output.includes(secret), "server output contains a secret");
        assert.ok(!bodies.some((b) => b.includes(secret)), "a response body contains a secret");
    }

    assert.ok(issuedTokens.length > 5);
    for (const token of issuedTokens) {
        assert.ok(!output.includes(token), "server output contains a refresh token");
        assert.ok(!output.includes(sha256(token)), "server output contains a token hash");
        assert.ok(!bodies.some((b) => b.includes(token)), "a response body contains a refresh token");
    }

    assert.ok(!bodies.some((b) => /passwordHash|tokenHash/.test(b)));
});
