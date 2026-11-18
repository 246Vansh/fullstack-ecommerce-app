// Admin user management API (/api/admin/users): ADMIN-only access, listing
// with search, filters and pagination, block/unblock, role changes with the
// acting admin's password, session revocation, and the row locking that keeps
// the store from ever losing its last administrator. Uses throwaway users
// tagged with RUN; after() removes them and their refresh tokens.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { createSession } = guard.ok ? await import("../services/refreshTokenService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const PASSWORD = `Admin-${RUN}-Pass1`;
// Fixture passwords only need to verify; cost 4 keeps the many fixtures fast.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const FORBIDDEN = { success: false, message: "You do not have permission to perform this action" };
const USER_KEYS = ["blockedAt", "createdAt", "email", "emailVerifiedAt", "firstName", "id", "isDeleted", "lastName", "orderCount", "role"];

const created = [];
let server, customer, demoted;

// A user of this run. `name` makes the names unique to it, so name searches
// only ever find this run's users.
async function makeUser(label, role = "CUSTOMER", { blockedAt = null, email, firstName, lastName } = {}) {
    const user = await prisma.user.create({
        data: {
            email: email ?? `p13-${label}-${RUN}@example.test`,
            passwordHash: PASSWORD_HASH,
            firstName: firstName ?? `First${label}`,
            lastName: lastName ?? `Last${label}`,
            role,
            blockedAt,
        },
    });
    created.push(user);
    return { ...user, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

const makeAdmin = (label) => makeUser(label, "ADMIN");

async function call(method, path, actor, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(actor?.headers ?? {}) },
        body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const list = (actor, query = {}) => call("GET", `/admin/users?${new URLSearchParams({ search: RUN, ...query })}`, actor);
const block = (actor, target) => call("POST", `/admin/users/${target.id}/block`, actor);
const unblock = (actor, target) => call("POST", `/admin/users/${target.id}/unblock`, actor);
const setRole = (actor, target, role, currentPassword = PASSWORD, extra = {}) =>
    call("PATCH", `/admin/users/${target.id}/role`, actor, { role, currentPassword, ...extra });

const roleOf = async (user) => (await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })).role;
const blockedAtOf = async (user) => (await prisma.user.findUnique({ where: { id: user.id }, select: { blockedAt: true } })).blockedAt;

// A real login session (refresh-token family) and an access token tied to it,
// made through the service rather than /auth/login, so these tests never spend
// the login rate limits.
async function startSession(user) {
    const { familyId } = await createSession(user.id, false);
    const headers = { Authorization: `Bearer ${signAccessToken(user, familyId)}` };
    return { familyId, headers, me: async () => (await call("GET", "/auth/me", { headers })).status };
}

const activeTokensOf = (familyId) => prisma.refreshToken.count({ where: { familyId, revokedAt: null } });

// Resolves once another connection to the test database has spent at least a
// second on one statement: the request under test is waiting for a row lock
// held by the test's open transaction. (Same check as in auth.test.js.)
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

// Runs change(tx) in a transaction and, while it is still uncommitted, starts
// request() and waits until it is blocked on that transaction; then commits.
async function raceAgainstOpenTransaction(change, request) {
    let pending;

    await prisma.$transaction(async (tx) => {
        await change(tx);
        pending = request();
        pending.catch(() => {});
        await waitForBlockedStatement();
    }, { timeout: 20_000 });

    return pending;
}

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    customer = await makeUser("customer");
    // A token still claiming ADMIN for a user whose role is CUSTOMER.
    const demotedUser = await makeUser("demoted");
    demoted = { headers: { Authorization: `Bearer ${signAccessToken({ id: demotedUser.id, role: "ADMIN" })}` } };

    server = await startServer(testServerEnv(guard));

    // A read the server can only answer from this run's rows: it is on the test database.
    const probe = await call("GET", `/admin/users?search=${RUN}`, await makeAdmin("probe"));
    assert.equal(probe.status, 200, JSON.stringify(probe.body));
    assert.ok(probe.body.data.some((u) => u.id === customer.id), "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's users (by id and email) and their refresh tokens.
        await deleteInTestDatabase(prisma, async (tx) => {
            const ids = created.map((u) => u.id);
            await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } });
            expectDeleted("users", await tx.user.deleteMany({ where: { id: { in: ids }, email: { in: created.map((u) => u.email) } } }), ids.length);
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ authorization

dbTest("auth: every user-management route needs a token and refuses customers, even when they claim ADMIN", async () => {
    const admin = await makeAdmin("auth");
    const target = await makeUser("auth-target");
    const forged = { headers: { Authorization: `Bearer ${jwt.sign({ sub: String(admin.id), role: "ADMIN", type: "access" }, "not-the-secret")}` } };
    const routes = [
        ["GET", "/admin/users"], ["POST", `/admin/users/${target.id}/block`], ["POST", `/admin/users/${target.id}/unblock`],
        ["PATCH", `/admin/users/${target.id}/role`],
    ];
    const body = { role: "ADMIN", currentPassword: PASSWORD };

    for (const [method, path] of routes) {
        assert.equal((await call(method, path, null, body)).status, 401, `${method} ${path} anonymous`);
        assert.equal((await call(method, path, forged, body)).status, 401, `${method} ${path} forged token`);
        const asCustomer = await call(method, path, customer, body);
        assert.equal(asCustomer.status, 403, `${method} ${path} customer`);
        assert.deepEqual(asCustomer.body, FORBIDDEN);
        assert.equal((await call(method, path, demoted, body)).status, 403, `${method} ${path} stale ADMIN token`);
    }

    assert.equal(await roleOf(target), "CUSTOMER", "nothing changed");
    assert.equal(await blockedAtOf(target), null, "nothing changed");
});

// ------------------------------------------------------------ listing

dbTest("list: safe fields only, newest first, with page totals", async () => {
    const admin = await makeAdmin("list");
    const { status, body } = await list(admin, { limit: 100 });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body.pagination).sort(), ["limit", "page", "total", "totalPages"]);
    const row = body.data.find((u) => u.id === customer.id);
    assert.deepEqual(Object.keys(row).sort(), USER_KEYS, "no passwordHash, phone or other columns");
    assert.equal(row.email, customer.email);
    assert.equal(row.role, "CUSTOMER");
    assert.equal(row.isDeleted, false);
    assert.equal(row.orderCount, 0);

    const ids = body.data.map((u) => u.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a), "newest (highest id) first");
});

dbTest("list: pagination returns consecutive, non-overlapping pages", async () => {
    const admin = await makeAdmin("pages");
    const tag = `pg${RUN}`;
    for (const n of [1, 2, 3]) await makeUser(`page${n}`, "CUSTOMER", { lastName: tag });

    const first = await list(admin, { search: tag, limit: 2, page: 1 });
    const second = await list(admin, { search: tag, limit: 2, page: 2 });
    const third = await list(admin, { search: tag, limit: 2, page: 3 });

    assert.deepEqual(first.body.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
    assert.equal(first.body.data.length, 2);
    assert.equal(second.body.data.length, 1);
    assert.equal(third.status, 200);
    assert.deepEqual(third.body.data, [], "past the last page is empty, not an error");
    assert.equal(new Set([...first.body.data, ...second.body.data].map((u) => u.id)).size, 3);
});

dbTest("search: by email, first name, last name and full name, case-insensitively", async () => {
    const admin = await makeAdmin("search");
    const target = await makeUser("searchme", "CUSTOMER", { firstName: `Alice${RUN}`, lastName: `Zephyr${RUN}` });
    const ids = async (search) => (await list(admin, { search, limit: 100 })).body.data.map((u) => u.id);

    assert.deepEqual(await ids(`p13-searchme-${RUN}`), [target.id], "email fragment");
    assert.deepEqual(await ids(`alice${RUN}`.toUpperCase()), [target.id], "first name, any case");
    assert.deepEqual(await ids(`Zephyr${RUN}`), [target.id], "last name");
    assert.deepEqual(await ids(`Alice${RUN} Zephyr${RUN}`), [target.id], "full name");
    assert.deepEqual(await ids(`  Zephyr${RUN}   Alice${RUN} `), [target.id], "words in any order, extra spaces ignored");
    assert.deepEqual(await ids(`Alice${RUN} Nobody${RUN}`), [], "every word must match");
});

dbTest("search: _ matches only a literal underscore, not any character", async () => {
    const admin = await makeAdmin("underscore");
    const literal = await makeUser("us_er");
    await makeUser("usxer"); // would match us_er if _ were a LIKE wildcard

    const res = await list(admin, { search: `p13-us_er-${RUN}` });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.map((u) => u.id), [literal.id]);
});

dbTest("filters: role and status; deleted accounts only with status=deleted", async () => {
    const admin = await makeAdmin("filters");
    const tag = `ft${RUN}`;
    const active = await makeUser("f-active", "CUSTOMER", { lastName: tag });
    const blocked = await makeUser("f-blocked", "CUSTOMER", { lastName: tag, blockedAt: new Date() });
    const otherAdmin = await makeUser("f-admin", "ADMIN", { lastName: tag });
    // What accountService.deleteAccount leaves behind.
    const deleted = await makeUser("f-deleted", "CUSTOMER", { lastName: tag, email: `deleted-${RUN}-ab12@deleted.invalid` });
    const ids = async (query) => (await list(admin, { search: tag, ...query })).body.data.map((u) => u.id).sort((a, b) => a - b);
    const sorted = (...users) => users.map((u) => u.id).sort((a, b) => a - b);

    assert.deepEqual(await ids({}), sorted(active, blocked, otherAdmin), "deleted hidden by default");
    assert.deepEqual(await ids({ status: "active" }), sorted(active, otherAdmin));
    assert.deepEqual(await ids({ status: "blocked" }), sorted(blocked));
    assert.deepEqual(await ids({ status: "deleted" }), sorted(deleted));
    assert.deepEqual(await ids({ role: "ADMIN" }), sorted(otherAdmin));
    assert.deepEqual(await ids({ role: "CUSTOMER", status: "active" }), sorted(active));

    const row = (await list(admin, { search: tag, status: "deleted" })).body.data[0];
    assert.equal(row.isDeleted, true);
    assert.ok((await list(admin, { search: tag, status: "blocked" })).body.data[0].blockedAt, "blockedAt is shown");
});

dbTest("validation: pagination, search, role and status inputs are checked", async () => {
    const admin = await makeAdmin("listval");
    const bad = [
        "page=0", "page=abc", "limit=0", "limit=101", "page=1&page=2", `search=${"x".repeat(101)}`,
        "search=50%25", "search=a%5Cb", "search=a b c d e f", "role=SUPERADMIN", "role=admin", "status=suspended",
        "status=active&status=blocked",
    ];

    for (const query of bad) {
        const { status, body } = await call("GET", `/admin/users?${query}`, admin);
        assert.equal(status, 422, `${query} -> ${JSON.stringify(body)}`);
        assert.equal(body.message, "Validation failed");
        assert.ok(Array.isArray(body.details) && body.details[0].field, query);
    }

    assert.equal((await call("GET", "/admin/users?search=", admin)).status, 200, "an empty search lists everyone");
});

dbTest("validation: user ids must be positive INT values", async () => {
    const admin = await makeAdmin("idval");

    for (const id of ["abc", "0", "-1", "2147483648", "1.5"]) {
        assert.equal((await call("POST", `/admin/users/${id}/block`, admin)).status, 422, `block ${id}`);
        assert.equal((await call("POST", `/admin/users/${id}/unblock`, admin)).status, 422, `unblock ${id}`);
        assert.equal((await call("PATCH", `/admin/users/${id}/role`, admin, { role: "ADMIN", currentPassword: PASSWORD })).status, 422, `role ${id}`);
    }

    assert.deepEqual((await call("POST", "/admin/users/2147483647/block", admin)).body, { success: false, message: "User not found" });
    assert.equal((await call("POST", "/admin/users/2147483647/unblock", admin)).status, 404);
    // admin has spent its five role-change attempts above (the limiter counts invalid ones too).
    assert.equal((await setRole(await makeAdmin("idval-2"), { id: 2147483647 }, "ADMIN")).status, 404);
});

// ------------------------------------------------------------ block / unblock

dbTest("block: sets blockedAt, ends every session of the customer at once, and is repeatable", async () => {
    const admin = await makeAdmin("blocker");
    const target = await makeUser("block-target");
    const sessionA = await startSession(target);
    const sessionB = await startSession(target);
    assert.equal(await sessionA.me(), 200, "signed in before the block");

    const { status, body } = await block(admin, target);

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body.data).sort(), USER_KEYS);
    assert.equal(body.data.id, target.id);
    assert.ok(body.data.blockedAt);
    assert.equal(await sessionA.me(), 401, "access token stops working immediately");
    assert.equal(await sessionB.me(), 401);
    assert.equal(await activeTokensOf(sessionA.familyId), 0, "refresh tokens revoked");
    assert.equal(await activeTokensOf(sessionB.familyId), 0);

    const firstBlockedAt = await blockedAtOf(target);
    const again = await block(admin, target);
    assert.equal(again.status, 200, "blocking a blocked account is harmless");
    assert.deepEqual(await blockedAtOf(target), firstBlockedAt, "the original block time is kept");
});

dbTest("unblock: clears blockedAt; the customer can sign in again", async () => {
    const admin = await makeAdmin("unblocker");
    const target = await makeUser("unblock-target", "CUSTOMER", { blockedAt: new Date() });

    const { status, body } = await unblock(admin, target);

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.data.blockedAt, null);
    assert.equal(await blockedAtOf(target), null);
    const session = await startSession(target);
    assert.equal(await session.me(), 200, "sessions can be created again");

    assert.equal((await unblock(admin, target)).status, 200, "unblocking an unblocked account is harmless");
});

dbTest("block: admins cannot block themselves, another admin, or a deleted account", async () => {
    const admin = await makeAdmin("noblock");
    const otherAdmin = await makeAdmin("noblock-other");
    const deleted = await makeUser("noblock-deleted", "CUSTOMER", { email: `deleted-${RUN}-cd34@deleted.invalid` });
    const session = await startSession(otherAdmin);

    const self = await block(admin, admin);
    assert.equal(self.status, 403);
    assert.equal(self.body.message, "You cannot block or unblock your own account");
    assert.equal((await unblock(admin, admin)).status, 403);

    const ofAdmin = await block(admin, otherAdmin);
    assert.equal(ofAdmin.status, 409);
    assert.equal(ofAdmin.body.message, "Administrators cannot be blocked; change their role to CUSTOMER first");

    const ofDeleted = await block(admin, deleted);
    assert.equal(ofDeleted.status, 409);
    assert.equal(ofDeleted.body.message, "This account has been deleted");
    assert.equal((await unblock(admin, deleted)).status, 409);

    for (const user of [admin, otherAdmin, deleted]) assert.equal(await blockedAtOf(user), null, "nothing was blocked");
    assert.equal(await session.me(), 200, "the other admin's session is untouched");
});

// ------------------------------------------------------------ role changes

dbTest("role: promote a customer and demote an admin; the target's sessions end", async () => {
    const admin = await makeAdmin("promoter");
    const target = await makeUser("promote-target");
    const customerSession = await startSession(target);

    const promoted = await setRole(admin, target, "ADMIN");
    assert.equal(promoted.status, 200, JSON.stringify(promoted.body));
    assert.equal(promoted.body.data.role, "ADMIN");
    assert.deepEqual(Object.keys(promoted.body.data).sort(), USER_KEYS);
    assert.equal(await roleOf(target), "ADMIN");
    assert.equal(await customerSession.me(), 401, "signed out, to sign in again with the new role");
    assert.equal(await activeTokensOf(customerSession.familyId), 0);

    const adminSession = await startSession({ ...target, role: "ADMIN" });
    const demotedRes = await setRole(admin, target, "CUSTOMER");
    assert.equal(demotedRes.status, 200, JSON.stringify(demotedRes.body));
    assert.equal(demotedRes.body.data.role, "CUSTOMER");
    assert.equal(await roleOf(target), "CUSTOMER");
    assert.equal(await adminSession.me(), 401);
});

dbTest("role: the acting admin's current password is required and verified", async () => {
    const admin = await makeAdmin("pwcheck");
    const target = await makeUser("pwcheck-target");

    const wrong = await setRole(admin, target, "ADMIN", "Wrong-Pass-123");
    assert.equal(wrong.status, 422);
    assert.deepEqual(wrong.body.details, [{ field: "currentPassword", message: "Password is incorrect" }]);

    // The target's password is not the acting admin's: it does not count.
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash: bcrypt.hashSync("Target-Pass-123", 4) } });
    assert.equal((await setRole(admin, target, "ADMIN", "Target-Pass-123")).status, 422);

    assert.equal(await roleOf(target), "CUSTOMER", "nothing changed");
});

dbTest("role: validation of role, currentPassword and unknown fields", async () => {
    const target = await makeUser("roleval-target");
    const invalid = [
        {}, { currentPassword: PASSWORD }, { role: "SUPERADMIN", currentPassword: PASSWORD }, { role: "admin", currentPassword: PASSWORD },
        { role: ["ADMIN"], currentPassword: PASSWORD }, { role: "ADMIN" }, { role: "ADMIN", currentPassword: "" },
        { role: "ADMIN", currentPassword: 12345678 }, { role: "ADMIN", currentPassword: "x".repeat(1025) },
    ];

    // The limiter counts every attempt (five per admin), so each case gets its own admin.
    for (const [i, body] of invalid.entries()) {
        const res = await call("PATCH", `/admin/users/${target.id}/role`, await makeAdmin(`roleval-${i}`), body);
        assert.equal(res.status, 422, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
        assert.equal(res.body.message, "Validation failed");
    }
    assert.equal(await roleOf(target), "CUSTOMER", "nothing changed");

    const other = await makeAdmin("roleval-ok");

    // Fields other than role are ignored, never written.
    const res = await setRole(other, target, "ADMIN", PASSWORD, { email: `hijack-${RUN}@example.test`, blockedAt: "2000-01-01", firstName: "X" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    assert.equal(stored.email, target.email);
    assert.equal(stored.firstName, target.firstName);
    assert.equal(stored.blockedAt, null);
});

dbTest("role: no changing your own role; no promoting blocked or deleted accounts; no no-op changes", async () => {
    const admin = await makeAdmin("rolerules");
    const blocked = await makeUser("rolerules-blocked", "CUSTOMER", { blockedAt: new Date() });
    const deleted = await makeUser("rolerules-deleted", "CUSTOMER", { email: `deleted-${RUN}-ef56@deleted.invalid` });

    const self = await setRole(admin, admin, "CUSTOMER");
    assert.equal(self.status, 403);
    assert.equal(self.body.message, "You cannot change your own role");

    const ofBlocked = await setRole(admin, blocked, "ADMIN");
    assert.equal(ofBlocked.status, 409);
    assert.equal(ofBlocked.body.message, "Unblock this account before making it an administrator");

    const ofDeleted = await setRole(admin, deleted, "ADMIN");
    assert.equal(ofDeleted.status, 409);
    assert.equal(ofDeleted.body.message, "This account has been deleted");

    // Another admin, for the limiter's five attempts per admin.
    const second = await makeAdmin("rolerules-2");
    const same = await setRole(second, blocked, "CUSTOMER");
    assert.equal(same.status, 409);
    assert.equal(same.body.message, "This user already has that role");

    assert.equal(await roleOf(admin), "ADMIN");
    assert.equal(await roleOf(blocked), "CUSTOMER");
    assert.equal(await roleOf(deleted), "CUSTOMER");
});

dbTest("role: attempts are limited per admin, wrong passwords included", async () => {
    const admin = await makeAdmin("rolelimit");
    const target = await makeUser("rolelimit-target");

    for (let i = 0; i < 5; i++) assert.equal((await setRole(admin, target, "ADMIN", "Wrong-Pass-123")).status, 422);
    assert.equal((await setRole(admin, target, "ADMIN")).status, 429, "the 6th attempt is limited, even with the right password");
    assert.equal(await roleOf(target), "CUSTOMER");

    // Per admin, not per target or IP: another admin is unaffected.
    assert.equal((await setRole(await makeAdmin("rolelimit-2"), target, "ADMIN")).status, 200);
});

// ------------------------------------------------------------ concurrency and the last administrator

dbTest("concurrency: two admins demoting each other at once leave exactly one administrator", async () => {
    for (let round = 0; round < 3; round++) {
        const a = await makeAdmin(`mutual-a${round}`);
        const b = await makeAdmin(`mutual-b${round}`);

        const results = await Promise.all([setRole(a, b, "CUSTOMER"), setRole(b, a, "CUSTOMER")]);

        assert.deepEqual(results.map((r) => r.status).sort(), [200, 403], `round ${round}: ${JSON.stringify(results.map((r) => r.body))}`);
        assert.deepEqual([await roleOf(a), await roleOf(b)].sort(), ["ADMIN", "CUSTOMER"], `round ${round}: one admin remains`);
    }
});

dbTest("concurrency: the acting admin's role is re-checked under the row lock (role change)", async () => {
    // p acts on q's row while q is being demoted by someone else; p is
    // demoted first, inside a transaction that commits while the request waits.
    const q = await makeAdmin("lock-q");
    const p = await makeAdmin("lock-p");

    const res = await raceAgainstOpenTransaction(
        (tx) => tx.user.update({ where: { id: p.id }, data: { role: "CUSTOMER" } }),
        () => setRole(p, q, "CUSTOMER"),
    );

    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.deepEqual(res.body, FORBIDDEN);
    assert.equal(await roleOf(q), "ADMIN", "the demoted admin changed nothing");
});

dbTest("concurrency: the acting admin's role is re-checked under the row lock (block)", async () => {
    const actor = await makeAdmin("lock-blocker");
    const target = await makeUser("lock-block-target");

    const res = await raceAgainstOpenTransaction(
        (tx) => tx.user.update({ where: { id: actor.id }, data: { role: "CUSTOMER" } }),
        () => block(actor, target),
    );

    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.equal(await blockedAtOf(target), null, "the demoted admin blocked nobody");
});

dbTest("concurrency: a customer promoted while being blocked ends up consistent, never a blocked admin", async () => {
    const promoter = await makeAdmin("mix-promoter");
    const blocker = await makeAdmin("mix-blocker");

    for (let round = 0; round < 3; round++) {
        const target = await makeUser(`mix-target${round}`);
        await Promise.all([setRole(promoter, target, "ADMIN"), block(blocker, target)]);

        const { role, blockedAt } = await prisma.user.findUnique({ where: { id: target.id }, select: { role: true, blockedAt: true } });
        assert.ok(!(role === "ADMIN" && blockedAt), `round ${round}: an admin can never be blocked (${role}, ${blockedAt})`);
    }
});
