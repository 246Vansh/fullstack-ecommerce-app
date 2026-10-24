// Client-side session handling against a fake API (an axios adapter): the
// 401 -> refresh -> retry interceptor (src/services/apiClient.js), session
// restore / logout / cross-tab sign-out (src/stores/authStore.js) and the
// router guard (src/router/authGuard.js). No server or browser involved.
// Run with: pnpm test
import "./support/alias.js";

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { AxiosError } = await import("axios");
const { createPinia, setActivePinia } = await import("pinia");
const { apiClient, setAccessToken, setRefreshHandler, setSessionExpiredHandler } = await import("../src/services/apiClient.js");
const { useAuthStore } = await import("../src/stores/authStore.js");
const { authGuard } = await import("../src/router/authGuard.js");

const USER = { id: 7, email: "a@example.test", role: "CUSTOMER", emailVerifiedAt: null };

// routes: { "METHOD /path": (config) => [status, body] }. Records every call.
function fakeApi(routes) {
    const calls = [];

    apiClient.defaults.adapter = async (config) => {
        const key = `${config.method.toUpperCase()} ${config.url}`;
        calls.push({ key, auth: config.headers.Authorization ?? null });

        const handler = routes[key];
        if (!handler) throw new Error(`unexpected request ${key}`);

        const [status, data] = await handler(config);
        const response = { status, data, headers: {}, config, statusText: String(status) };

        if (status >= 400) {
            throw new AxiosError(`status ${status}`, "ERR_BAD_RESPONSE", config, null, response);
        }

        return response;
    };

    return calls;
}

const tick = (ms = 0) => new Promise((ok) => setTimeout(ok, ms));

let expired;

beforeEach(() => {
    setActivePinia(createPinia());
    setAccessToken(null);
    setRefreshHandler(null);
    expired = 0;
    setSessionExpiredHandler(() => { expired += 1; });
});

// ---------- apiClient interceptor ----------

test("concurrent 401s share one refresh, then every request is retried with the new token", async () => {
    setAccessToken("old");
    let refreshes = 0;

    setRefreshHandler(async () => {
        refreshes += 1;
        await tick(20);
        setAccessToken("new");
        return true;
    });

    const calls = fakeApi({
        "GET /orders": (config) => (config.headers.Authorization === "Bearer new" ? [200, { ok: "orders" }] : [401, {}]),
        "GET /cart": (config) => (config.headers.Authorization === "Bearer new" ? [200, { ok: "cart" }] : [401, {}]),
        "GET /account/sessions": (config) => (config.headers.Authorization === "Bearer new" ? [200, { ok: "sessions" }] : [401, {}]),
    });

    const results = await Promise.all([apiClient.get("/orders"), apiClient.get("/cart"), apiClient.get("/account/sessions")]);

    assert.deepEqual(results.map((r) => r.data.ok), ["orders", "cart", "sessions"]);
    assert.equal(refreshes, 1, "one refresh for three 401s");
    assert.equal(calls.length, 6, "each request sent twice");
    assert.equal(expired, 0);
});

test("a failed refresh rejects every waiting request and reports expiry once", async () => {
    setRefreshHandler(async () => { await tick(10); return false; });
    fakeApi({ "GET /orders": () => [401, {}], "GET /cart": () => [401, {}] });

    const results = await Promise.allSettled([apiClient.get("/orders"), apiClient.get("/cart")]);

    assert.deepEqual(results.map((r) => r.status), ["rejected", "rejected"]);
    assert.equal(expired, 1, "session-expired handler called once");
});

test("no refresh loop: /auth calls and an already-retried request are not refreshed again", async () => {
    let refreshes = 0;
    setRefreshHandler(async () => { refreshes += 1; return true; });

    const calls = fakeApi({ "POST /auth/login": () => [401, {}], "GET /orders": () => [401, {}] });

    await assert.rejects(apiClient.post("/auth/login", {}));
    assert.equal(refreshes, 0, "a 401 from /auth/* never triggers a refresh");

    await assert.rejects(apiClient.get("/orders"));
    assert.equal(refreshes, 1, "refreshed once, retried once, then gave up");
    assert.equal(calls.filter((c) => c.key === "GET /orders").length, 2);
});

// ---------- authStore ----------

test("restoreSession: one refresh per page load; success signs in with an in-memory token", async () => {
    let refreshes = 0;
    const calls = fakeApi({
        "POST /auth/refresh": async () => { refreshes += 1; await tick(10); return [200, { user: USER, accessToken: "tok" }]; },
        "GET /orders": () => [200, {}],
        "POST /auth/logout": () => [200, {}],
    });

    const auth = useAuthStore();
    await Promise.all([auth.restoreSession(), auth.restoreSession(), auth.restoreSession()]);

    assert.equal(refreshes, 1);
    assert.equal(auth.initialized, true);
    assert.equal(auth.isAuthenticated, true);

    await apiClient.get("/orders");
    assert.equal(calls.at(-1).auth, "Bearer tok", "access token attached from memory");

    // Every store in this file listens on the same tab channel; sign this one out.
    await auth.logout();
});

test("restoreSession: a rejected refresh leaves a guest, initialized, with no token", async () => {
    const calls = fakeApi({ "POST /auth/refresh": () => [401, { message: "No active session" }], "GET /products": () => [200, {}] });

    const auth = useAuthStore();
    await auth.restoreSession();

    assert.equal(auth.initialized, true);
    assert.equal(auth.isAuthenticated, false);

    await apiClient.get("/products");
    assert.equal(calls.at(-1).auth, null);
});

test("logout clears the session even when the request fails", async () => {
    fakeApi({
        "POST /auth/login": () => [200, { user: USER, accessToken: "tok" }],
        "POST /auth/logout": () => [500, {}],
    });

    const auth = useAuthStore();
    await auth.login({ email: USER.email, password: "x", remember: false });
    assert.equal(auth.isAuthenticated, true);

    await assert.rejects(auth.logout());
    assert.equal(auth.isAuthenticated, false);
});

test("logoutAll calls /auth/logout-all and clears the session", async () => {
    const calls = fakeApi({
        "POST /auth/login": () => [200, { user: USER, accessToken: "tok" }],
        "POST /auth/logout-all": () => [200, { success: true }],
    });

    const auth = useAuthStore();
    await auth.login({ email: USER.email, password: "x", remember: false });
    await auth.logoutAll();

    assert.equal(auth.isAuthenticated, false);
    assert.ok(calls.some((c) => c.key === "POST /auth/logout-all"));
});

test("sign-out in another tab clears this tab and reports the session expired", async () => {
    fakeApi({ "POST /auth/login": () => [200, { user: USER, accessToken: "tok" }] });

    const auth = useAuthStore();
    await auth.login({ email: USER.email, password: "x", remember: false });

    const otherTab = new BroadcastChannel("auth");
    otherTab.postMessage("logout");
    otherTab.close();

    for (let i = 0; i < 50 && auth.isAuthenticated; i++) await tick(10);

    assert.equal(auth.isAuthenticated, false);
    assert.equal(expired, 1);
});

// ---------- router guard ----------

async function guardFor(user, to) {
    fakeApi({ "POST /auth/refresh": () => (user ? [200, { user, accessToken: "tok" }] : [401, {}]) });
    return authGuard({ meta: {}, query: {}, fullPath: "/", ...to });
}

test("guard: guests on protected pages go to login with the destination kept", async () => {
    assert.deepEqual(await guardFor(null, { meta: { requiresAuth: true }, fullPath: "/orders?page=2" }),
        { name: "login", query: { redirect: "/orders?page=2" } });
});

test("guard: signed-in users leave guest pages for a safe redirect, never back to login", async () => {
    const login = (redirect) => ({ meta: { guestOnly: true }, query: { redirect } });

    assert.equal(await guardFor(USER, login("/orders")), "/orders");
    setActivePinia(createPinia());
    assert.deepEqual(await guardFor(USER, login("//evil.example")), { name: "home" });
    setActivePinia(createPinia());
    assert.deepEqual(await guardFor(USER, login("/login?redirect=/login")), { name: "home" });
    setActivePinia(createPinia());
    assert.deepEqual(await guardFor(USER, login(undefined)), { name: "home" });
});

test("guard: non-admins get forbidden on admin pages; public pages pass", async () => {
    assert.deepEqual(await guardFor(USER, { meta: { requiresAuth: true, requiresAdmin: true } }), { name: "forbidden" });
    setActivePinia(createPinia());
    assert.equal(await guardFor(null, { meta: {} }), true);
});
