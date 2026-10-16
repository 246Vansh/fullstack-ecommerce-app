// Shared guard for test files that write to a database. They run only against
// a dedicated test database named by TEST_DATABASE_URL, never the development
// database from .env (DATABASE_URL is not a fallback). adminOrders.test.js
// holds the full unit test for testDatabaseGuard.
import assert from "node:assert/strict";

// The development database, plus MySQL's own schemas.
const FORBIDDEN_DATABASES = ["ecommerce", "mysql", "information_schema", "performance_schema", "sys"];

// Writing tests clean up only here, so they write nowhere else.
export const CLEANUP_DATABASE = "ecommerce_test";

const databaseNameOf = (url) => new URL(url).pathname.slice(1);

// { ok: true, url, database } or { ok: false, missing, reason }. Reasons never
// include the URL, which carries the password.
export function testDatabaseGuard(env = process.env) {
    const raw = env.TEST_DATABASE_URL;
    const refuse = (reason) => ({ ok: false, missing: false, reason });

    if (raw === undefined || raw === "") return { ok: false, missing: true, reason: "TEST_DATABASE_URL is not set" };

    let url;
    try {
        url = new URL(raw);
    } catch {
        return refuse("TEST_DATABASE_URL is not a valid URL");
    }

    if (raw.trim() !== raw) return refuse("TEST_DATABASE_URL has surrounding whitespace");
    if (!["mysql:", "mariadb:"].includes(url.protocol)) return refuse("TEST_DATABASE_URL must be a mysql:// or mariadb:// URL");
    if (!url.hostname) return refuse("TEST_DATABASE_URL must name a host");

    // Exactly one plain database name, compared as config/db.js reads it (no decoding).
    const database = url.pathname.slice(1);
    if (!/^[A-Za-z0-9_$]{1,64}$/.test(database)) {
        return refuse("TEST_DATABASE_URL must name one database (letters, digits, _ or $)");
    }

    let developmentDatabase = null;
    if (env.DATABASE_URL) {
        try {
            developmentDatabase = databaseNameOf(env.DATABASE_URL);
        } catch {
            return refuse("DATABASE_URL could not be read, so TEST_DATABASE_URL cannot be checked against it");
        }
    }

    // Case-insensitive: MySQL on Windows treats ECOMMERCE and ecommerce as one database.
    const forbidden = [...FORBIDDEN_DATABASES, developmentDatabase].filter(Boolean).map((name) => name.toLowerCase());
    if (forbidden.includes(database.toLowerCase())) {
        return refuse(`TEST_DATABASE_URL points to "${database}", which is not a dedicated test database`);
    }

    return { ok: true, url: raw, database };
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

// ------------------------------------------------------------ writing test files

// Call at the top level of a test file that writes, before anything imports
// config/db.js (directly or through a service): switches DATABASE_URL to the
// guarded test URL, then loads the Prisma client. Without a usable guard the
// client is never loaded, so nothing connects to any database.
export async function openTestDatabase(env = process.env) {
    const guard = testDatabaseGuard(env);
    const skip = guard.ok ? false : `database tests disabled: ${guard.reason}`;
    if (!guard.ok) return { guard, skip, prisma: undefined };

    env.DATABASE_URL = guard.url;
    const { default: prisma } = await import("../config/db.js");
    return { guard, skip, prisma };
}

// Fails (never skips) when TEST_DATABASE_URL is set but is not a dedicated test database.
export function testDatabaseGuardTest(test, guard) {
    test("TEST_DATABASE_URL names a dedicated test database", { skip: guard.missing && `database tests disabled: ${guard.reason}` }, () => {
        assert.ok(guard.ok, guard.reason);
    });
}

// Environment for a spawned server or script. DOTENV_CONFIG_OVERRIDE (any
// non-empty value, even "false") would make its dotenv replace DATABASE_URL
// with the one in .env; spawn drops undefined keys, so the child never sees it.
export const testServerEnv = (guard) => ({ DATABASE_URL: guard.url, DOTENV_CONFIG_OVERRIDE: undefined });

// Before any write: this connection really is on CLEANUP_DATABASE.
export async function assertOnTestDatabase(prisma) {
    const [{ name }] = await prisma.$queryRaw`SELECT DATABASE() AS name`;
    assert.equal(name, CLEANUP_DATABASE, `tests that write run only in ${CLEANUP_DATABASE}`);
}

// Runs deleteRows(tx) in one transaction, after re-checking the database on
// the transaction's own connection. Any error inside rolls everything back.
export function deleteInTestDatabase(prisma, deleteRows) {
    return prisma.$transaction(async (tx) => {
        const [{ name }] = await tx.$queryRaw`SELECT DATABASE() AS name`;
        if (name !== CLEANUP_DATABASE) throw new Error(`connected to "${name}", not "${CLEANUP_DATABASE}"; nothing deleted`);
        return deleteRows(tx);
    }, { timeout: 60_000 });
}

// Inside deleteInTestDatabase: a delete must remove exactly the tracked rows,
// otherwise the whole cleanup rolls back.
export function expectDeleted(label, { count }, expected) {
    if (count !== expected) throw new Error(`deleted ${count} of ${expected} ${label}`);
    return count;
}

// Removes database URLs and the test database password from text for logs.
export function redactor(guard) {
    return (text) => {
        let out = String(text).replace(/\b(mysql|mariadb):\/\/\S+/gi, "<database-url>");
        if (!guard.ok) return out;
        const { password } = new URL(guard.url);
        for (const secret of new Set([password, safeDecode(password)])) {
            if (secret) out = out.split(secret).join("<redacted>");
        }
        return out;
    };
}
