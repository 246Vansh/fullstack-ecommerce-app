// Email-verification UX against a fake API (an axios adapter): sign-up lands
// on /verify-email (src/composables/useAuth.js), and the account page's
// resend button (src/composables/useAccountSecurity.js) calls the resend
// endpoint once per click with loading, success, error and rate-limit
// states. No server or browser involved. Run with: pnpm test
import "./support/alias.js";

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { AxiosError } = await import("axios");
const { createApp, h } = await import("vue");
const { createPinia, setActivePinia } = await import("pinia");
const { createRouter, createMemoryHistory } = await import("vue-router");
const { apiClient, setAccessToken } = await import("../src/services/apiClient.js");
const { useAuthStore } = await import("../src/stores/authStore.js");
const { useAuth } = await import("../src/composables/useAuth.js");
const { useAccountSecurity } = await import("../src/composables/useAccountSecurity.js");

const USER = { id: 7, email: "new@example.test", role: "CUSTOMER", emailVerifiedAt: null };

// routes: { "METHOD /path": (config) => [status, body] }. Records every call.
function fakeApi(routes) {
    const calls = [];

    apiClient.defaults.adapter = async (config) => {
        const key = `${config.method.toUpperCase()} ${config.url}`;
        calls.push({ key, auth: config.headers.Authorization ?? null, data: config.data });

        const handler = routes[key] ?? (() => [200, { success: true, sessions: [] }]);
        const [status, data] = await handler(config);
        const response = { status, data, headers: {}, config, statusText: String(status) };

        if (status >= 400) {
            throw new AxiosError(`status ${status}`, "ERR_BAD_RESPONSE", config, null, response);
        }

        return response;
    };

    return calls;
}

const Blank = { render: () => h("div") };

// Runs a composable with a router and pinia installed, as inside a page.
async function withApp(composable, startAt = "/register?redirect=/checkout") {
    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
        history: createMemoryHistory(),
        routes: ["/", "/register", "/checkout", "/verify-email", "/account", "/login"].map((path) => ({
            path, name: path === "/" ? "home" : path.slice(1), component: Blank,
        })),
    });

    await router.push(startAt);

    const app = createApp(Blank).use(pinia).use(router);
    const result = app.runWithContext(composable);

    return { router, auth: useAuthStore(), result };
}

let deferred;
const later = () => new Promise((resolve) => { deferred = resolve; });

beforeEach(() => {
    setAccessToken(null);
    deferred = null;
});

// ---------- after registration ----------

test("successful sign-up signs in and goes to /verify-email, without any token in the URL", async () => {
    const calls = fakeApi({
        "POST /auth/register": () => [201, { success: true, user: USER }],
        "POST /auth/login": () => [200, { success: true, user: USER, accessToken: "access-1" }],
    });

    const { router, auth, result } = await withApp(useAuth);
    Object.assign(result.signUp, {
        firstName: "New", lastName: "User", email: USER.email, password: "Passw0rd!", confirmPassword: "Passw0rd!",
    });

    await result.handleSignUp();

    assert.deepEqual(calls.map((c) => c.key), ["POST /auth/register", "POST /auth/login"]);
    assert.equal(router.currentRoute.value.path, "/verify-email");
    assert.deepEqual(router.currentRoute.value.query, {});
    assert.equal(auth.user.email, USER.email);
    assert.equal(result.signUp.password, "");
});

test("a failed sign-up stays on /register and shows the server error", async () => {
    fakeApi({
        "POST /auth/register": () => [409, { success: false, message: "Email already registered" }],
    });

    const { router, result } = await withApp(useAuth);
    Object.assign(result.signUp, {
        firstName: "New", lastName: "User", email: USER.email, password: "Passw0rd!", confirmPassword: "Passw0rd!",
    });

    await result.handleSignUp();

    assert.equal(router.currentRoute.value.path, "/register");
    assert.equal(result.signUp.errors.email, "Email already registered");
});

// ---------- account page resend ----------

async function signedIn() {
    const app = await withApp(useAccountSecurity, "/account");
    app.auth.updateUser({ ...USER });
    setAccessToken("access-1");
    return app;
}

test("resend calls the endpoint with the session token and shows the server's message", async () => {
    const calls = fakeApi({
        "POST /account/verification-email": () => later().then(() => [200, { success: true, message: "A new verification link is on its way. Check your inbox." }]),
    });

    const { result: { verification, handleResendVerification } } = await signedIn();

    const pending = handleResendVerification();
    assert.equal(verification.loading, true);

    // A second click while the first is in flight sends nothing.
    await handleResendVerification();

    // The request reaches the adapter after axios's async interceptors.
    while (!deferred) await new Promise((ok) => setTimeout(ok, 0));
    deferred();
    await pending;

    const resends = calls.filter((c) => c.key === "POST /account/verification-email");
    assert.equal(resends.length, 1);
    assert.equal(resends[0].auth, "Bearer access-1");
    assert.equal(verification.loading, false);
    assert.equal(verification.message, "A new verification link is on its way. Check your inbox.");
    assert.equal(verification.error, "");
    assert.equal(verification.rateLimited, false);
});

test("resend: a 429 (cooldown or limiter) is shown as rate-limit feedback, not an error", async () => {
    fakeApi({
        "POST /account/verification-email": () => [429, { success: false, message: "Too many verification emails requested, please try again later" }],
    });

    const { result: { verification, handleResendVerification } } = await signedIn();
    await handleResendVerification();

    assert.equal(verification.rateLimited, true);
    assert.equal(verification.message, "Too many verification emails requested, please try again later");
    assert.equal(verification.error, "");
    assert.equal(verification.loading, false);
});

test("resend: a server failure shows an error and re-enables the button", async () => {
    fakeApi({
        "POST /account/verification-email": () => [500, { success: false, message: "Internal server error" }],
    });

    const { result: { verification, handleResendVerification } } = await signedIn();
    await handleResendVerification();

    assert.equal(verification.error, "Internal server error");
    assert.equal(verification.message, "");
    assert.equal(verification.loading, false);
});

test("resend: 409 (already verified) updates the signed-in user so the banner goes away", async () => {
    fakeApi({
        "POST /account/verification-email": () => [409, { success: false, message: "Your email address is already verified" }],
    });

    const { auth, result: { verification, handleResendVerification } } = await signedIn();
    await handleResendVerification();

    assert.ok(auth.user.emailVerifiedAt);
    assert.equal(verification.error, "");
});
