// Rate limiters: auth, general, order placement and proxy handling. Every
// server reads the database (logins, catalog), and the order test logs in as a
// customer this run creates, so all of it runs against the test database.
//
// Uses only the test database named by TEST_DATABASE_URL (see testDatabase.js);
// unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { startServer, login, post } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const { guard, skip, prisma } = await openTestDatabase();

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const USER = { email: `phase6-limits-${RUN}@example.test`, password: `Limits-${RUN}-Pass1` };
const CATEGORY_SLUG = `phase6-limits-${RUN}`;
let user, category;

const badLogin = (url, headers) => post(`${url}/auth/login`, { email: "nobody-phase6@example.com", password: "Wrong-Pass-123" }, { headers });

// Every server gets the guarded database last, so no per-test setting can
// replace it, and must list this run's category (a GET on the general
// limiter, which no test here exhausts) before the test uses it.
async function serve(env = {}) {
    const server = await startServer({ ...env, ...testServerEnv(guard) });
    const probe = await (await fetch(`${server.url}/categories`)).json().catch(() => null);
    if (!JSON.stringify(probe).includes(`"${CATEGORY_SLUG}"`)) {
        await server.stop();
        throw new Error("server is not on the test database");
    }
    return server;
}

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    category = await prisma.category.create({ data: { name: `Phase 6 Limits ${RUN}`, slug: CATEGORY_SLUG } });
    user = await prisma.user.create({
        data: { email: USER.email, passwordHash: await bcrypt.hash(USER.password, 10), firstName: "Test", lastName: "Limits", role: "CUSTOMER" },
    });
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's user (refresh tokens and cart first; nothing else
        // references it) and its category.
        await deleteInTestDatabase(prisma, async (tx) => {
            if (user) {
                await tx.refreshToken.deleteMany({ where: { userId: user.id } });
                await tx.cart.deleteMany({ where: { userId: user.id } });
                expectDeleted("users", await tx.user.deleteMany({ where: { id: user.id, email: USER.email } }), 1);
            }
            if (category) expectDeleted("categories", await tx.category.deleteMany({ where: { id: category.id, slug: CATEGORY_SLUG } }), 1);
        });
    } finally {
        await prisma.$disconnect();
    }
});

dbTest("10/11. auth limiter blocks the 21st login, but not catalog reads", async () => {
    const server = await serve();
    try {
        for (let i = 0; i < 20; i++) {
            assert.equal((await badLogin(server.url)).status, 401, `attempt ${i + 1}`);
        }

        const blocked = await badLogin(server.url);
        assert.equal(blocked.status, 429);
        assert.deepEqual(await blocked.json(), { success: false, message: "Too many attempts, please try again later" });

        // Valid credentials are blocked too while limited.
        assert.equal((await login(server.url, USER)).res.status, 429);

        // Separate budgets: catalog, categories and health still work.
        assert.equal((await fetch(`${server.url}/products?limit=1`)).status, 200);
        assert.equal((await fetch(`${server.url}/categories`)).status, 200);
        assert.equal((await fetch(`${server.url}/health`)).status, 200);
        // Session refresh has its own budget: 401 (no cookie), not 429.
        assert.equal((await post(`${server.url}/auth/refresh`)).status, 401);
    } finally {
        await server.stop();
    }
});

dbTest("2. spoofed X-Forwarded-For does not bypass the limiter (TRUST_PROXY unset)", async () => {
    const server = await serve({ TRUST_PROXY: "" });
    try {
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": `203.0.113.${i}` });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "198.51.100.7" })).status, 429);
    } finally {
        await server.stop();
    }
});

dbTest("2. with TRUST_PROXY=1 the client IP comes from X-Forwarded-For", async () => {
    const server = await serve({ TRUST_PROXY: "1" });
    try {
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" })).status, 429);
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.2" })).status, 401, "different client, own budget");
    } finally {
        await server.stop();
    }
});

// Valid production settings for a server started over plain http in tests.
// Online payment is off (no Razorpay keys), whatever the developer's .env has:
// with keys, production would also require RAZORPAY_WEBHOOK_SECRET.
const PRODUCTION = {
    NODE_ENV: "production", CLIENT_URL: "https://shop.example.com", COOKIE_SECURE: "true", DATABASE_SSL: "false",
    RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "",
};

dbTest("production with TRUST_PROXY=false (direct deployment) starts, and spoofed X-Forwarded-For is ignored", async () => {
    const server = await serve({ ...PRODUCTION, TRUST_PROXY: "false" });
    try {
        assert.equal((await fetch(`${server.url}/health`)).status, 200);
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": `203.0.113.${i}` });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "198.51.100.7" })).status, 429);
    } finally {
        await server.stop();
    }
});

dbTest("production with a trusted proxy CIDR takes the client IP from X-Forwarded-For", async () => {
    // The test connects from 127.0.0.1, which plays the trusted proxy here.
    const server = await serve({ ...PRODUCTION, TRUST_PROXY: "127.0.0.0/8" });
    try {
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" })).status, 429);
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.2" })).status, 401, "different client, own budget");
    } finally {
        await server.stop();
    }
});

dbTest("11. normal browsing volume is not blocked by the general limiter", async () => {
    const server = await serve();
    try {
        // The old global limit was 300 per 15 minutes.
        const statuses = [];
        for (let i = 0; i < 40; i++) {
            const batch = await Promise.all(Array.from({ length: 10 }, () => fetch(`${server.url}/categories`)));
            statuses.push(...batch.map((r) => r.status));
        }
        assert.equal(statuses.length, 400);
        assert.ok(statuses.every((s) => s === 200), `non-200: ${statuses.filter((s) => s !== 200).length}`);
    } finally {
        await server.stop();
    }
});

dbTest("12. order placement is limited per user; reads keep working", async () => {
    const server = await serve();
    try {
        const { res: loggedIn, body } = await login(server.url, USER);
        assert.equal(loggedIn.status, 200, "this run's customer logs in");
        const auth = { Authorization: `Bearer ${body.accessToken}` };

        // A non-existent address fails inside the order transaction: nothing is written.
        for (let i = 0; i < 10; i++) {
            const res = await post(`${server.url}/orders`, { addressId: 999999999 }, { headers: auth });
            assert.ok([404, 409].includes(res.status), `attempt ${i + 1}: ${res.status}`);
        }

        const blocked = await post(`${server.url}/orders`, { addressId: 999999999 }, { headers: auth });
        assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).message, "Too many order attempts, please try again later");

        assert.equal((await fetch(`${server.url}/cart`, { headers: auth })).status, 200);
        assert.equal((await fetch(`${server.url}/checkout`, { headers: auth })).status === 429, false);
        assert.equal((await fetch(`${server.url}/products?limit=1`)).status, 200);
    } finally {
        await server.stop();
    }
});
