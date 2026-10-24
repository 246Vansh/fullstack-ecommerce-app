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
import { tokenLifetimeSeconds } from "../utils/jwt.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { loginUser } = guard.ok ? await import("../services/authService.js") : {};
const { revokeAllUserSessions, createSession } = guard.ok ? await import("../services/refreshTokenService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
// SALT_ROUNDS in services/authService.js: the timing test compares this hash
// against the app's dummy hash, so both must cost the same.
const SALT_ROUNDS = 12;
const USER = { email: `phase6-auth-${RUN}@example.test`, password: `Auth-${RUN}-Pass1` };
// Its password is changed by the concurrent-login test.
const RACE_USER = { email: `phase6-auth-race-${RUN}@example.test`, password: `Race-${RUN}-Pass1` };
const INVALID_LOGIN = { success: false, message: "Invalid email or password" };

const sha256 = (token) => crypto.createHash("sha256").update(token).digest("hex");
const row = (token) => prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });

// The lifetimes the server under test uses (same environment, same defaults as utils/jwt.js).
const REFRESH_LIFETIME_MS = tokenLifetimeSeconds(process.env.JWT_REFRESH_EXPIRES_IN || "7d") * 1000;
const SESSION_LIFETIME_MS = tokenLifetimeSeconds(process.env.SESSION_ABSOLUTE_EXPIRES_IN || "30d") * 1000;
const jwtExpMs = (token) => jwt.decode(token).exp * 1000;
const refresh = async (token) => track(await post(`${server.url}/auth/refresh`, undefined, { cookie: token }));
// Moves a session's absolute expiry (every token of the family), to test the
// end of a session without waiting for it. The tokens' JWTs stay valid.
const setSessionExpiry = (familyId, sessionExpiresAt) => prisma.refreshToken.updateMany({ where: { familyId }, data: { sessionExpiresAt } });

// Resolves once another connection to the test database has spent at least a
// second on one statement: the request under test is waiting for a lock held
// by the test's open transaction. TIME counts whole seconds since the
// statement started, so TIME >= 1 can show a few milliseconds in; >= 2 means
// at least one full second. PROCESSLIST lists this database user's own
// connections without any extra privilege; the holding transaction is idle
// (Sleep) between statements, so it does not match. The driver sends prepared
// statements, which show as Execute rather than Query.
async function waitForBlockedStatement(timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const [{ n }] = await prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
            WHERE DB = DATABASE() AND COMMAND IN ('Query', 'Execute') AND TIME >= 2 AND ID <> CONNECTION_ID()`;
        if (Number(n) > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("the request never waited for the open transaction, so the race was not exercised");
}

// Runs revoke(tx) in a transaction and, while it is still uncommitted, starts
// request() and waits until it is blocked on that transaction; then runs
// whileBlocked(tx), if given, and commits. Returns the request's response.
async function raceAgainstOpenTransaction(revoke, request, whileBlocked) {
    let pending;

    await prisma.$transaction(async (tx) => {
        await revoke(tx);
        pending = request();
        pending.catch(() => {});
        await waitForBlockedStatement();
        await whileBlocked?.(tx);
    }, { timeout: 20_000 });

    return pending;
}

let server, user, raceUser;
// Accounts created through /auth/register by this run.
const registered = [];
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
    raceUser = await prisma.user.create({
        data: { email: RACE_USER.email, passwordHash: await bcrypt.hash(RACE_USER.password, SALT_ROUNDS), firstName: "Test", lastName: "Race", role: "CUSTOMER" },
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
        // Only this run's users and their refresh tokens (carts cascade with them).
        const created = [user, raceUser, ...registered].filter(Boolean);

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

dbTest("5c. a refresh that waits on a revocation (password change, logout) issues no token", async () => {
    const { token } = await login(server.url, USER);
    issuedTokens.push(token);
    const { familyId } = await row(token);

    // Revoked the way a password change does, committed while the refresh is in progress.
    const res = await track(await raceAgainstOpenTransaction(
        (tx) => revokeAllUserSessions(user.id, { db: tx }),
        () => post(`${server.url}/auth/refresh`, undefined, { cookie: token }),
    ));

    assert.equal(res.status, 401);
    assert.match(setCookieHeader(res), /refreshToken=;/, "cookie cleared, no new token set");
    assert.equal(await prisma.refreshToken.count({ where: { familyId, revokedAt: null } }), 0, "no active token in the revoked family");
});

dbTest("5d. a just-rotated token (grace window) issues no token once its family is revoked mid-refresh", async () => {
    const { token: first } = await login(server.url, USER);
    const second = refreshCookie(await track(await post(`${server.url}/auth/refresh`, undefined, { cookie: first })));
    issuedTokens.push(first);
    const { familyId } = await row(first);
    assert.equal((await row(second)).revokedAt, null);

    const res = await track(await raceAgainstOpenTransaction(
        (tx) => revokeAllUserSessions(user.id, { db: tx }),
        () => post(`${server.url}/auth/refresh`, undefined, { cookie: first }),
    ));

    assert.equal(res.status, 401);
    assert.equal(await prisma.refreshToken.count({ where: { familyId, revokedAt: null } }), 0, "no active token in the revoked family");
});

dbTest("5e. a refresh racing a password change takes the user row before its token (no deadlock)", async () => {
    const { token } = await login(server.url, USER);
    issuedTokens.push(token);
    const { familyId } = await row(token);
    const { passwordHash } = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });

    // accountService.changePassword's order: the user row (rewritten with the
    // same hash, so USER keeps its password), then, with the refresh already
    // waiting, every session revoked. A refresh that locked its token first
    // would hold it while waiting for the user row: a deadlock.
    const res = await track(await raceAgainstOpenTransaction(
        (tx) => tx.user.update({ where: { id: user.id }, data: { passwordHash } }),
        () => post(`${server.url}/auth/refresh`, undefined, { cookie: token }),
        (tx) => revokeAllUserSessions(user.id, { db: tx }),
    ));

    assert.equal(res.status, 401);
    assert.match(setCookieHeader(res), /refreshToken=;/, "cookie cleared, no new token set");
    assert.equal(await prisma.refreshToken.count({ where: { familyId, revokedAt: null } }), 0, "no active token in the revoked family");
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

dbTest("6b. a login that checked the old password creates no session once a password change commits", async () => {
    const existing = await login(server.url, RACE_USER);
    assert.equal(existing.res.status, 200);
    issuedTokens.push(existing.token);
    const newHash = await bcrypt.hash(`Race-${RUN}-Changed2`, SALT_ROUNDS);

    // What accountService.changePassword commits: the new hash, then every session revoked.
    const res = await track(await raceAgainstOpenTransaction(
        async (tx) => {
            await tx.user.update({ where: { id: raceUser.id }, data: { passwordHash: newHash } });
            await revokeAllUserSessions(raceUser.id, { db: tx });
        },
        () => post(`${server.url}/auth/login`, RACE_USER),
    ));

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), INVALID_LOGIN, "same answer as a wrong password");
    assert.equal(refreshCookie(res), null);
    assert.equal(await prisma.refreshToken.count({ where: { userId: raceUser.id, revokedAt: null } }), 0, "no active session survives the change");
});

dbTest("8. registration limits passwords to 72 UTF-8 bytes, not 72 characters", async () => {
    const register = (key, password) => post(`${server.url}/auth/register`, {
        firstName: "Test", lastName: "Bytes", email: `phase1-bytes-${key}-${RUN}@example.test`, password,
    });
    const cases = [
        ["below", "é".repeat(35) + "a", 201], // 71 bytes
        ["at", "é".repeat(36), 201], // 72 bytes
        ["above", "é".repeat(37), 422], // 37 characters, 74 bytes
    ];

    for (const [key, password, status] of cases) {
        const res = await track(await register(key, password));
        const body = await res.json();
        if (res.status === 201) registered.push(body.user);

        assert.equal(res.status, status, `${key} (${Buffer.byteLength(password)} bytes)`);
        if (status === 422) assert.equal(body.details[0].field, "password");
    }

    const atLimit = await prisma.user.findUnique({ where: { email: `phase1-bytes-at-${RUN}@example.test` } });
    assert.ok(await bcrypt.compare("é".repeat(36), atLimit.passwordHash), "the 72-byte password is stored whole");
});

dbTest("8b. an oversized login password is rejected by validation, before bcrypt", async () => {
    const res = await track(await post(`${server.url}/auth/login`, { email: USER.email, password: "x".repeat(1025) }));
    const body = await res.json();

    // 422 from the validator, not the 401 that comparing the password would give.
    assert.equal(res.status, 422);
    assert.equal(body.details[0].field, "password");
    assert.match(body.details[0].message, /too long/i);
    assert.equal(refreshCookie(res), null);
});

// Sessions below start with createSession() rather than /auth/login: the
// login rate limit (20 per window) is nearly used up by the tests above.

dbTest("9. login sets the inactivity and the absolute expiry", async () => {
    const before = Date.now();
    const { token } = await login(server.url, USER, { remember: true });
    issuedTokens.push(token);
    const after = Date.now();
    const { expiresAt, sessionExpiresAt } = await row(token);

    assert.ok(sessionExpiresAt >= before + SESSION_LIFETIME_MS && sessionExpiresAt <= after + SESSION_LIFETIME_MS, "absolute expiry = login + session lifetime");
    assert.ok(expiresAt >= before + REFRESH_LIFETIME_MS - 1000 && expiresAt <= after + REFRESH_LIFETIME_MS, "token expiry = login + refresh lifetime");
    assert.ok(expiresAt < sessionExpiresAt, "a new session is limited by inactivity first");
    assert.ok(Math.abs(jwtExpMs(token) - expiresAt) < 1000, "JWT exp matches the stored expiry");
});

dbTest("9b. repeated refreshes keep the original absolute expiry", async () => {
    let { token, familyId } = await createSession(user.id, true);
    issuedTokens.push(token);
    const { sessionExpiresAt } = await row(token);

    for (let i = 0; i < 3; i++) {
        const res = await refresh(token);
        assert.equal(res.status, 200);
        token = refreshCookie(res);

        const rotated = await row(token);
        assert.equal(rotated.familyId, familyId);
        assert.equal(rotated.sessionExpiresAt.getTime(), sessionExpiresAt.getTime(), `refresh ${i + 1} kept the absolute expiry`);
        assert.ok(rotated.expiresAt <= sessionExpiresAt);
    }

    const all = await prisma.refreshToken.findMany({ where: { familyId } });
    assert.equal(all.length, 4);
    assert.ok(all.every((t) => t.sessionExpiresAt.getTime() === sessionExpiresAt.getTime()), "every token of the session has the same absolute expiry");
});

dbTest("9c. near the absolute expiry, the refresh token, its row and the persistent cookie are capped", async () => {
    const { token, familyId } = await createSession(user.id, true);
    issuedTokens.push(token);
    const sessionExpiresAt = new Date(Date.now() + 60_000);
    await setSessionExpiry(familyId, sessionExpiresAt);

    const res = await refresh(token);
    assert.equal(res.status, 200);
    const next = refreshCookie(res);
    const rotated = await row(next);

    assert.equal(rotated.sessionExpiresAt.getTime(), sessionExpiresAt.getTime());
    assert.ok(jwtExpMs(next) <= sessionExpiresAt.getTime() && jwtExpMs(next) > sessionExpiresAt.getTime() - 1000, "JWT exp capped at the absolute expiry");
    assert.ok(rotated.expiresAt <= sessionExpiresAt && rotated.expiresAt > sessionExpiresAt.getTime() - 2000, "stored expiry capped at the absolute expiry");

    const maxAge = Number(/Max-Age=(\d+)/i.exec(setCookieHeader(res))?.[1]);
    assert.ok(maxAge > 0 && maxAge <= 60, `persistent cookie Max-Age capped (${maxAge}s)`);
});

dbTest("9d. a refresh after, or within a second of, the absolute expiry issues no token", async () => {
    for (const [name, offset] of [["expired", -1000], ["under a second left", 500]]) {
        const { token, familyId } = await createSession(user.id, true);
        issuedTokens.push(token);
        await setSessionExpiry(familyId, new Date(Date.now() + offset));
        assert.ok(jwtExpMs(token) > Date.now(), "the JWT itself is still valid");

        const res = await refresh(token);

        assert.equal(res.status, 401, name);
        assert.match(setCookieHeader(res), /refreshToken=;/, `${name}: cookie cleared`);
        assert.equal(await prisma.refreshToken.count({ where: { familyId } }), 1, `${name}: no token added to the session`);
        assert.equal((await row(token)).revokedAt, null, `${name}: an expired session is not treated as token reuse`);
    }
});

dbTest("9e. the concurrent-tab grace path keeps the absolute expiry, and issues nothing once it has passed", async () => {
    // Within the session: the just-rotated token gets a new token with the same absolute expiry.
    {
        const { token: first, familyId } = await createSession(user.id, true);
        issuedTokens.push(first);
        const { sessionExpiresAt } = await row(first);
        assert.equal((await refresh(first)).status, 200);

        const again = await refresh(first);
        assert.equal(again.status, 200, "grace path");
        const graceRow = await row(refreshCookie(again));
        assert.equal(graceRow.familyId, familyId);
        assert.equal(graceRow.sessionExpiresAt.getTime(), sessionExpiresAt.getTime(), "grace token kept the absolute expiry");
    }

    // Past it: the same grace-window replay is refused and adds nothing.
    {
        const { token: first, familyId } = await createSession(user.id, true);
        issuedTokens.push(first);
        assert.equal((await refresh(first)).status, 200);
        await setSessionExpiry(familyId, new Date(Date.now() - 1000));

        const again = await refresh(first);
        assert.equal(again.status, 401, "grace path after the absolute expiry");
        assert.match(setCookieHeader(again), /refreshToken=;/);
        assert.equal(await prisma.refreshToken.count({ where: { familyId } }), 2, "no token added to the session");
        assert.equal(await prisma.refreshToken.count({ where: { familyId, revokedReason: "REUSE" } }), 0, "not treated as token reuse");
    }
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
