// Admin order fulfilment API: ADMIN-only access, listing, one-step status
// transitions, timestamps, concurrency and interaction with customer
// cancellation. Fixtures: two fixture users and item-less orders (no stock
// involved). after() deletes exactly the rows this run created, and only in
// ecommerce_test; a fixture user left by an earlier run is reused, not deleted.
//
// Because they write to the database, these tests run only against a dedicated
// test database named by TEST_DATABASE_URL (see testDatabase.js), never the
// development database from .env (DATABASE_URL is not a fallback). Unset: the
// database tests are skipped. Set but unusable: the guard test fails and the
// rest are skipped. Either way nothing connects to a database. When it is
// usable, before() checks that both this process and the spawned server really
// use it before writing.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import { CLEANUP_DATABASE, testDatabaseGuard, redactor } from "./testDatabase.js";

const guard = testDatabaseGuard();
const skip = guard.ok ? false : `database tests disabled: ${guard.reason}`;
const redact = redactor(guard);

// config/db.js reads DATABASE_URL when first imported, so switch it before
// importing anything that uses the database; the server gets it explicitly.
if (guard.ok) process.env.DATABASE_URL = guard.url;
const { default: prisma } = guard.ok ? await import("../config/db.js") : {};
const { FULFILMENT_STEPS, nextStatusOf } = guard.ok ? await import("../services/orderService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);

test("the database guard accepts only a dedicated test database", () => {
    const pass = "s3cret-pass";
    const dev = `mysql://app:${pass}@127.0.0.1:3306/ecommerce`;
    const check = (TEST_DATABASE_URL, DATABASE_URL = dev) => testDatabaseGuard({ TEST_DATABASE_URL, DATABASE_URL });

    assert.deepEqual(check(undefined), { ok: false, missing: true, reason: "TEST_DATABASE_URL is not set" });
    assert.equal(check("").missing, true);

    const ok = check(`mysql://app:${pass}@127.0.0.1:3306/ecommerce_test`);
    assert.equal(ok.ok, true);
    assert.equal(ok.database, "ecommerce_test");
    assert.equal(check(`mariadb://app:${pass}@db.internal/shop_test`).ok, true);

    const refused = {
        "not a url": /not a valid URL/,
        [` mysql://app:${pass}@127.0.0.1/ecommerce_test`]: /whitespace/,
        [`postgres://app:${pass}@127.0.0.1/ecommerce_test`]: /mysql:\/\/ or mariadb:\/\//,
        "mysql:///ecommerce_test": /must name a host/,
        [`mysql://app:${pass}@127.0.0.1:3306`]: /one database/,
        [`mysql://app:${pass}@127.0.0.1:3306/`]: /one database/,
        [`mysql://app:${pass}@127.0.0.1/ecommerce_test/x`]: /one database/,
        [`mysql://app:${pass}@127.0.0.1/%65commerce`]: /one database/,
        [`mysql://app:${pass}@127.0.0.1/ecommerce`]: /points to "ecommerce"/,
        [`mysql://app:${pass}@127.0.0.1/ECOMMERCE`]: /points to "ECOMMERCE"/,
        [`mysql://app:${pass}@other-host:3307/ecommerce`]: /points to "ecommerce"/,
        [`mysql://app:${pass}@127.0.0.1/mysql`]: /points to "mysql"/,
    };
    for (const [url, reason] of Object.entries(refused)) {
        const result = check(url);
        assert.equal(result.ok, false, url);
        assert.equal(result.missing, false, url);
        assert.match(result.reason, reason, url);
        assert.ok(!result.reason.includes(pass) && !result.reason.includes("app:"), `no credentials in: ${result.reason}`);
    }

    // A renamed development database is still refused, and an unreadable DATABASE_URL fails closed.
    assert.match(check(`mysql://app:${pass}@127.0.0.1/shop_dev`, `mysql://app:${pass}@127.0.0.1/shop_dev`).reason, /points to "shop_dev"/);
    assert.match(check(`mysql://app:${pass}@127.0.0.1/shop_test`, "not a url").reason, /DATABASE_URL could not be read/);
    assert.equal(check(`mysql://app:${pass}@127.0.0.1/shop_test`, undefined).ok, true);
});

// Fails when TEST_DATABASE_URL is set but unusable, so a misconfiguration is not a silent skip.
test("TEST_DATABASE_URL names a dedicated test database", { skip: guard.missing && skip }, () => {
    assert.ok(guard.ok, guard.reason);
});

const RUN = crypto.randomBytes(4).toString("hex");
let server, admin, customer, sequence = 0;

// Every row this run created in CLEANUP_DATABASE, the only database cleanup will touch.
const created = { users: [], orders: [] };

// Reuses the user if it already exists (not this run's to delete); otherwise
// creates it and records it for cleanup.
async function fixtureUser(label, role) {
    const email = `admin-orders-${label}@example.test`;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        user = await prisma.user.create({ data: { email, passwordHash: "not-a-login", firstName: "Fixture", lastName: label, role } });
        created.users.push({ id: user.id, email });
    }

    assert.equal(user.role, role, `fixture ${label} has role ${role}`);
    return { id: user.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

// An item-less order for the fixture customer, so no stock is ever involved.
async function makeOrder(overrides = {}) {
    sequence += 1;
    const order = await prisma.order.create({
        data: {
            orderNumber: `AOT-${RUN}-${sequence}`, userId: customer.id, status: "PENDING", paymentStatus: "UNPAID",
            subtotal: "40.00", shipping: "0.00", tax: "0.00", discount: "0.00", total: "40.00",
            shippingFirstName: "Fixture", shippingLastName: "Customer", shippingPhone: "5550000000",
            shippingEmail: "admin-orders-customer@example.test", shippingAddress: "1 Fixture Way",
            shippingCity: "Austin", shippingState: "TX", shippingZipCode: "73301", shippingCountry: "United States",
            ...overrides,
        },
    });
    created.orders.push({ id: order.id, orderNumber: order.orderNumber });
    return order;
}

// Teardown diagnostics, on stderr so they show in every run mode. Only the run
// id, counts, stages and error names/messages, with URLs and the password removed.
const note = (message) => console.error(`[admin-orders] run ${RUN}: ${message}`);

// Deletes exactly the rows in `created`, all or nothing. The database name is
// read on the transaction's own connection; orders go first (Order -> User is
// onDelete: Restrict); each delete matches ids and this run's order numbers or
// fixture emails, and a count that differs from what was recorded rolls back.
async function cleanUpRun() {
    note(`cleanup entered, tracking ${created.orders.length} orders and ${created.users.length} users`);
    if (!created.orders.length && !created.users.length) return note("cleanup had nothing to delete");

    const left = () => `orders ${created.orders.map((o) => o.orderNumber).join(", ") || "none"}; users ${created.users.map((u) => u.id).join(", ") || "none"}`;

    let stage = "verify database";
    let deleted;

    try {
        deleted = await prisma.$transaction(async (tx) => {
            const [{ name }] = await tx.$queryRaw`SELECT DATABASE() AS name`;
            if (name !== CLEANUP_DATABASE) throw new Error(`connected to "${name}", not "${CLEANUP_DATABASE}"`);

            stage = "delete orders";
            const orders = await tx.order.deleteMany({
                where: { id: { in: created.orders.map((o) => o.id) }, orderNumber: { in: created.orders.map((o) => o.orderNumber) } },
            });
            if (orders.count !== created.orders.length) throw new Error(`deleted ${orders.count} of ${created.orders.length} orders`);

            stage = "delete users";
            const users = await tx.user.deleteMany({
                where: { id: { in: created.users.map((u) => u.id) }, email: { in: created.users.map((u) => u.email) } },
            });
            if (users.count !== created.users.length) throw new Error(`deleted ${users.count} of ${created.users.length} users`);

            stage = "commit";
            return { orders: orders.count, users: users.count };
        });
    } catch (err) {
        // An error from the callback rolls the transaction back; one at "commit" leaves the outcome unknown.
        const outcome = stage === "commit" ? "commit failed, outcome unknown" : `rolled back at "${stage}", nothing was deleted`;
        const reason = `${err?.name ?? "Error"}: ${redact(err?.message ?? err)}`;
        note(`cleanup ${outcome}: ${reason}`);
        throw new Error(`cleanup ${outcome} (left: ${left()}): ${reason}`);
    }

    note(`cleanup committed, deleted ${deleted.orders} orders and ${deleted.users} users`);

    created.orders.length = 0;
    created.users.length = 0;
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const advance = (id, status, user = admin, extra = {}) => call("PATCH", `/admin/orders/${id}/status`, user, { status, ...extra });

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is connected to the test database.
    const [{ name }] = await prisma.$queryRaw`SELECT DATABASE() AS name`;
    assert.equal(String(name).toLowerCase(), guard.database.toLowerCase(), "test client is on the test database");
    // Cleanup runs only in ecommerce_test, so write nothing it would refuse to remove.
    assert.equal(name, CLEANUP_DATABASE, `tests that write run only in ${CLEANUP_DATABASE}`);
    note(`writing to ${CLEANUP_DATABASE}`);

    admin = await fixtureUser("admin", "ADMIN");
    customer = await fixtureUser("customer", "CUSTOMER");

    // DOTENV_CONFIG_OVERRIDE (any non-empty value, even "false") would make the
    // server's dotenv replace this DATABASE_URL with the one in .env; spawn
    // drops undefined keys, so the server never sees it.
    server = await startServer({ DATABASE_URL: guard.url, DOTENV_CONFIG_OVERRIDE: undefined });

    // Before any request that writes: the server reads an order that exists
    // only in the test database (a GET, so a misrouted server changes nothing).
    const probe = await makeOrder();
    const seen = await call("GET", `/admin/orders/${probe.id}`, admin);
    assert.equal(seen.body?.data?.orderNumber, probe.orderNumber, "server is on the test database");
});

// Stops the server first (no requests in flight), then cleans up, then
// disconnects. Every step runs; any failure fails the run instead of vanishing.
after(async () => {
    const errors = [];

    for (const step of [() => server?.stop(), cleanUpRun, () => prisma?.$disconnect()]) {
        try {
            await step();
        } catch (err) {
            errors.push(err);
        }
    }

    // Run directly (node tests/adminOrders.test.js), a throwing top-level after()
    // is printed but the summary still says "fail 0" and the exit code is 0.
    if (errors.length) process.exitCode = 1;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, `admin order test teardown failed: ${errors.map((e) => redact(e?.message ?? e)).join("; ")}`);
});

dbTest("transition rule: one step forward along the fulfilment path only", () => {
    assert.deepEqual(FULFILMENT_STEPS.map(nextStatusOf), ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", null]);
    assert.equal(nextStatusOf("CANCELLED"), null);
    assert.equal(nextStatusOf("REFUNDED"), null);
});

dbTest("every admin order endpoint rejects signed-out users and customers", async () => {
    const order = await makeOrder();

    for (const [method, path, body] of [["GET", "/admin/orders"], ["GET", `/admin/orders/${order.id}`], ["PATCH", `/admin/orders/${order.id}/status`, { status: "CONFIRMED" }]]) {
        assert.equal((await call(method, path, null, body)).status, 401, `${method} ${path} signed out`);
        assert.equal((await call(method, path, customer, body)).status, 403, `${method} ${path} as customer`);
    }

    const after = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
    assert.equal(after.status, "PENDING", "a rejected request changed nothing");
});

dbTest("list: all customers' orders, newest first, with status filter and pagination", async () => {
    const shipped = await makeOrder({ status: "SHIPPED" });
    const newest = await makeOrder();

    const { status, body } = await call("GET", "/admin/orders?limit=5", admin);
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body.pagination).sort(), ["limit", "page", "total", "totalPages"]);
    assert.equal(body.data[0].id, newest.id, "newest first");
    const row = body.data[0];
    assert.deepEqual(row.customer, { name: "Fixture Customer", email: "admin-orders-customer@example.test" });
    assert.equal(row.total, 40);
    assert.equal(row.itemCount, 0);
    assert.equal(row.nextStatus, "CONFIRMED");

    const filtered = await call("GET", "/admin/orders?status=SHIPPED&limit=100", admin);
    assert.ok(filtered.body.data.length > 0 && filtered.body.data.every((o) => o.status === "SHIPPED"));
    assert.ok(filtered.body.data.some((o) => o.id === shipped.id));

    const page2 = await call("GET", "/admin/orders?limit=1&page=2", admin);
    assert.equal(page2.body.data.length, 1);
    assert.notEqual(page2.body.data[0].id, newest.id);
});

dbTest("list: invalid filters are rejected", async () => {
    for (const query of ["status=SHIPPEDX", "status=SHIPPED&status=PENDING", "limit=101", "page=0"]) {
        assert.equal((await call("GET", `/admin/orders?${query}`, admin)).status, 422, query);
    }
});

dbTest("detail: the stored snapshot with fulfilment fields; 404 for a missing order", async () => {
    const order = await makeOrder();
    const { status, body } = await call("GET", `/admin/orders/${order.id}`, admin);

    assert.equal(status, 200);
    assert.equal(body.data.orderNumber, order.orderNumber);
    assert.equal(body.data.userId, customer.id);
    assert.equal(body.data.nextStatus, "CONFIRMED");
    assert.equal(body.data.shippedAt, null);
    assert.equal(body.data.shippingAddress.city, "Austin");
    assert.ok(!("cancellable" in body.data), "customer-only field left out");

    assert.equal((await call("GET", "/admin/orders/2147483647", admin)).status, 404);
    assert.equal((await call("GET", "/admin/orders/abc", admin)).status, 422);
});

dbTest("full path PENDING -> DELIVERED sets timestamps and never touches money or payment", async () => {
    const order = await makeOrder();

    for (const step of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
        const { status, body } = await advance(order.id, step);
        assert.equal(status, 200, `${step}: ${JSON.stringify(body)}`);
        assert.equal(body.data.status, step);
    }

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(stored.status, "DELIVERED");
    assert.ok(stored.shippedAt instanceof Date && stored.deliveredAt instanceof Date);
    assert.ok(stored.deliveredAt >= stored.shippedAt);
    assert.equal(stored.paymentStatus, "UNPAID");
    assert.equal(stored.total.toString(), "40");
    assert.equal(stored.subtotal.toString(), "40");

    const done = await call("GET", `/admin/orders/${order.id}`, admin);
    assert.equal(done.body.data.nextStatus, null);
});

dbTest("skipping, repeating or going backwards is a 409 and changes nothing", async () => {
    const order = await makeOrder();

    let res = await advance(order.id, "SHIPPED");
    assert.equal(res.status, 409);
    assert.match(res.body.message, /is pending and cannot be marked shipped/);

    assert.equal((await advance(order.id, "CONFIRMED")).status, 200);
    res = await advance(order.id, "CONFIRMED");
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already confirmed/);

    const delivered = await makeOrder({ status: "DELIVERED" });
    assert.equal((await advance(delivered.id, "PROCESSING")).status, 409);

    const stored = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true, shippedAt: true } });
    assert.deepEqual(stored, { status: "CONFIRMED", shippedAt: null });
});

dbTest("cancelled and refunded orders never move", async () => {
    for (const current of ["CANCELLED", "REFUNDED"]) {
        const order = await makeOrder({ status: current });
        for (const step of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
            assert.equal((await advance(order.id, step)).status, 409, `${current} -> ${step}`);
        }
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, current);
    }
});

dbTest("only fulfilment steps are accepted, and other body fields are ignored", async () => {
    const order = await makeOrder();

    for (const status of ["PENDING", "CANCELLED", "REFUNDED", "confirmed", "", 3, null]) {
        assert.equal((await advance(order.id, status)).status, 422, JSON.stringify(status));
    }
    assert.equal((await call("PATCH", `/admin/orders/${order.id}/status`, admin, {})).status, 422);

    const res = await advance(order.id, "CONFIRMED", admin, { paymentStatus: "PAID", total: "0.01", userId: admin.id });
    assert.equal(res.status, 200);
    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(stored.paymentStatus, "UNPAID");
    assert.equal(stored.total.toString(), "40");
    assert.equal(stored.userId, customer.id);
});

dbTest("two admins confirming at once: exactly one succeeds", async () => {
    const order = await makeOrder();
    const results = await Promise.all(Array.from({ length: 5 }, () => advance(order.id, "CONFIRMED")));

    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409, 409, 409]);
});

dbTest("customer cancellation and admin confirmation exclude each other", async () => {
    // Confirmed first: the customer can no longer cancel.
    const confirmed = await makeOrder();
    assert.equal((await advance(confirmed.id, "CONFIRMED")).status, 200);
    const cancel = await call("POST", `/orders/${confirmed.id}/cancel`, customer);
    assert.equal(cancel.status, 409);
    assert.equal((await prisma.order.findUnique({ where: { id: confirmed.id } })).status, "CONFIRMED");

    // Cancelled first: the admin can no longer confirm.
    const cancelled = await makeOrder();
    assert.equal((await call("POST", `/orders/${cancelled.id}/cancel`, customer)).status, 200);
    assert.equal((await advance(cancelled.id, "CONFIRMED")).status, 409);

    // The customer sees the admin's change on their own order.
    const mine = await call("GET", `/orders/${confirmed.id}`, customer);
    assert.equal(mine.body.data.status, "CONFIRMED");
    assert.equal(mine.body.data.cancellable, false);
});
