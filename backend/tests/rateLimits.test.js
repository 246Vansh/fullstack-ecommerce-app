import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { startServer, login, post } from "./helpers.js";

const badLogin = (url, headers) => post(`${url}/auth/login`, { email: "nobody-phase6@example.com", password: "Wrong-Pass-123" }, { headers });

test("10/11. auth limiter blocks the 21st login, but not catalog reads", async () => {
    const server = await startServer();
    try {
        for (let i = 0; i < 20; i++) {
            assert.equal((await badLogin(server.url)).status, 401, `attempt ${i + 1}`);
        }

        const blocked = await badLogin(server.url);
        assert.equal(blocked.status, 429);
        assert.deepEqual(await blocked.json(), { success: false, message: "Too many attempts, please try again later" });

        // Valid credentials are blocked too while limited.
        assert.equal((await login(server.url)).res.status, 429);

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

test("2. spoofed X-Forwarded-For does not bypass the limiter (TRUST_PROXY unset)", async () => {
    const server = await startServer({ TRUST_PROXY: "" });
    try {
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": `203.0.113.${i}` });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "198.51.100.7" })).status, 429);
    } finally {
        await server.stop();
    }
});

test("2. with TRUST_PROXY=1 the client IP comes from X-Forwarded-For", async () => {
    const server = await startServer({ TRUST_PROXY: "1" });
    try {
        for (let i = 0; i < 20; i++) await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" });
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.1" })).status, 429);
        assert.equal((await badLogin(server.url, { "X-Forwarded-For": "203.0.113.2" })).status, 401, "different client, own budget");
    } finally {
        await server.stop();
    }
});

test("11. normal browsing volume is not blocked by the general limiter", async () => {
    const server = await startServer();
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

test("12. order placement is limited per user; reads keep working", async () => {
    const server = await startServer();
    try {
        const { body } = await login(server.url);
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
