import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import prisma, { databaseSsl, createConnectionErrorLogger } from "../config/db.js";
import { migrationDatabaseUrl } from "../prisma.config.js";
import { validateEnv, parseTrustProxy } from "../config/env.js";
import { runNode, startServer } from "./helpers.js";

const SECRET_A = "short-SECRET-VALUE-A"; // 20 chars, under the 32 minimum
const SECRET_B = "b".repeat(40) + "SECRET-VALUE-B";

// Each case starts server.js with one bad value; startup must stop with a
// clear message naming the variable, and never print secret values.
const CASES = [
    ["missing DATABASE_URL", { DATABASE_URL: "" }, /DATABASE_URL is required/],
    ["non-mysql DATABASE_URL", { DATABASE_URL: "postgres://u:p@localhost/db" }, /DATABASE_URL must be a mysql/],
    ["missing JWT_ACCESS_SECRET", { JWT_ACCESS_SECRET: "" }, /JWT_ACCESS_SECRET is required/],
    ["short JWT_ACCESS_SECRET", { JWT_ACCESS_SECRET: SECRET_A }, /JWT_ACCESS_SECRET must be at least 32/],
    ["missing JWT_REFRESH_SECRET", { JWT_REFRESH_SECRET: "" }, /JWT_REFRESH_SECRET is required/],
    ["same access/refresh secret", { JWT_ACCESS_SECRET: SECRET_B, JWT_REFRESH_SECRET: SECRET_B }, /must be different/],
    ["missing CLIENT_URL", { CLIENT_URL: "" }, /CLIENT_URL is required/],
    ["invalid CLIENT_URL", { CLIENT_URL: "localhost:5173" }, /CLIENT_URL must be an http/],
    ["missing NODE_ENV", { NODE_ENV: "" }, /NODE_ENV is required/],
    ["invalid NODE_ENV", { NODE_ENV: "staging" }, /NODE_ENV must be one of/],
    ["TRUST_PROXY=true", { TRUST_PROXY: "true" }, /TRUST_PROXY must be/],
    ["production without secure cookies", { NODE_ENV: "production", CLIENT_URL: "https://shop.example.com", COOKIE_SECURE: "false" }, /COOKIE_SECURE cannot be false/],
    ["production with http CLIENT_URL", { NODE_ENV: "production", CLIENT_URL: "http://shop.example.com" }, /CLIENT_URL must use https/],
    ["production without TRUST_PROXY", { NODE_ENV: "production", CLIENT_URL: "https://shop.example.com", COOKIE_SECURE: "true", TRUST_PROXY: "" }, /TRUST_PROXY is required in production/],
    ["malformed TRUST_PROXY list", { TRUST_PROXY: "yes" }, /TRUST_PROXY must be/],
    ["production without DATABASE_SSL", { NODE_ENV: "production", CLIENT_URL: "https://shop.example.com", COOKIE_SECURE: "true", TRUST_PROXY: "false", DATABASE_SSL: "" }, /DATABASE_SSL is required in production/],
    ["DATABASE_SSL_CA that is not a certificate", { DATABASE_SSL: "true", DATABASE_SSL_CA: "package.json" }, /DATABASE_SSL_CA must be the path to a readable PEM certificate file/],
];

for (const [name, env, expected] of CASES) {
    test(`14. startup fails: ${name}`, async () => {
        const { code, output } = await runNode(["server.js"], { PORT: "5599", ...env });

        assert.equal(code, 1, output);
        assert.match(output, /Invalid configuration/);
        assert.match(output, expected);
        assert.doesNotMatch(output, /Server running/);
        for (const secret of [SECRET_A, SECRET_B, process.env.JWT_ACCESS_SECRET, process.env.JWT_REFRESH_SECRET, new URL(process.env.DATABASE_URL).password]) {
            assert.ok(!output.includes(secret), "a secret value was printed");
        }
    });
}

test("14. several problems are reported together", async () => {
    const { code, output } = await runNode(["server.js"], { PORT: "5599", CLIENT_URL: "", JWT_ACCESS_SECRET: "" });
    assert.equal(code, 1);
    assert.match(output, /CLIENT_URL is required/);
    assert.match(output, /JWT_ACCESS_SECRET is required/);
});

// A production environment that is valid apart from TRUST_PROXY.
const PRODUCTION = {
    NODE_ENV: "production",
    DATABASE_URL: "mysql://user:pass@localhost:3306/shop",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    CLIENT_URL: "https://shop.example.com",
    DATABASE_SSL: "false",
};

const trustProxyErrors = (env) => validateEnv(env).filter((error) => error.includes("TRUST_PROXY"));

test("TRUST_PROXY: required in production when missing, empty or blank", () => {
    for (const TRUST_PROXY of [undefined, "", "   "]) {
        assert.deepEqual(trustProxyErrors({ ...PRODUCTION, TRUST_PROXY }), [
            'TRUST_PROXY is required in production: "false" when clients connect directly, otherwise the proxies in front of the app',
        ], `TRUST_PROXY=${JSON.stringify(TRUST_PROXY)}`);
    }
});

test("TRUST_PROXY: explicit false (direct deployment) and trusted proxy settings are accepted", () => {
    for (const TRUST_PROXY of ["false", "1", "loopback", "10.0.0.0/8", "10.0.0.5, 192.168.0.0/16"]) {
        assert.deepEqual(validateEnv({ ...PRODUCTION, TRUST_PROXY }), [], `TRUST_PROXY=${TRUST_PROXY}`);
    }
    assert.equal(parseTrustProxy("false"), false);
});

test("TRUST_PROXY: true and malformed values are rejected, never treated as trust-all", () => {
    for (const TRUST_PROXY of ["true", "TRUE", "yes", "*", "10.0.0.0/99"]) {
        assert.equal(trustProxyErrors({ ...PRODUCTION, TRUST_PROXY }).length, 1, `TRUST_PROXY=${TRUST_PROXY}`);
        assert.notEqual(parseTrustProxy(TRUST_PROXY), true);
    }
});

test("TRUST_PROXY: still optional outside production (unset means false)", () => {
    assert.deepEqual(validateEnv({ ...PRODUCTION, NODE_ENV: "development" }), []);
    assert.equal(parseTrustProxy(undefined), false);
});

// Throwaway self-signed certificate; its private key was discarded.
const TEST_CA = fileURLToPath(new URL("./fixtures/test-ca.pem", import.meta.url));
const SECURE_PRODUCTION = { ...PRODUCTION, TRUST_PROXY: "false" };

const databaseSslErrors = (env) => validateEnv(env).filter((error) => error.includes("DATABASE_SSL"));

test("DATABASE_SSL: off unless explicitly true, so local development is unchanged", () => {
    for (const DATABASE_SSL of [undefined, "", "false"]) {
        assert.equal(databaseSsl({ DATABASE_SSL }), undefined, `DATABASE_SSL=${DATABASE_SSL}`);
    }
    assert.deepEqual(validateEnv({ ...SECURE_PRODUCTION, NODE_ENV: "development", DATABASE_SSL: undefined }), []);
});

test("DATABASE_SSL: true always verifies the certificate, with the optional CA file", () => {
    assert.deepEqual(databaseSsl({ DATABASE_SSL: "true" }), { rejectUnauthorized: true });
    assert.deepEqual(databaseSsl({ DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA }), {
        rejectUnauthorized: true,
        ca: readFileSync(TEST_CA, "utf8"),
    });
    assert.deepEqual(validateEnv({ ...SECURE_PRODUCTION, DATABASE_SSL: "true" }), []);
    assert.deepEqual(validateEnv({ ...SECURE_PRODUCTION, DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA }), []);
});

test("DATABASE_SSL: required in production; explicit false is accepted", () => {
    for (const DATABASE_SSL of [undefined, ""]) {
        assert.deepEqual(databaseSslErrors({ ...SECURE_PRODUCTION, DATABASE_SSL }), [
            'DATABASE_SSL is required in production: "true" (verified TLS) or "false" (database reached only over a trusted private network)',
        ]);
    }
    assert.deepEqual(validateEnv({ ...SECURE_PRODUCTION, DATABASE_SSL: "false" }), []);
});

test("DATABASE_SSL: invalid values and unusable CA settings are rejected without printing them", () => {
    for (const DATABASE_SSL of ["yes", "1", "TRUE", "require"]) {
        assert.deepEqual(databaseSslErrors({ ...SECURE_PRODUCTION, DATABASE_SSL }), ['DATABASE_SSL must be "true" or "false"']);
    }

    // A CA without DATABASE_SSL=true would look like TLS but connect in plaintext.
    for (const DATABASE_SSL of [undefined, "false"]) {
        assert.ok(databaseSslErrors({ ...SECURE_PRODUCTION, DATABASE_SSL, DATABASE_SSL_CA: TEST_CA })
            .includes("DATABASE_SSL_CA is set but DATABASE_SSL is not true, so TLS would be off"), `DATABASE_SSL=${DATABASE_SSL}`);
    }

    for (const DATABASE_SSL_CA of ["does-not-exist.pem", "package.json", "tests"]) {
        const errors = databaseSslErrors({ ...SECURE_PRODUCTION, DATABASE_SSL: "true", DATABASE_SSL_CA });
        assert.deepEqual(errors, ["DATABASE_SSL_CA must be the path to a readable PEM certificate file"], DATABASE_SSL_CA);
        assert.ok(!errors[0].includes(DATABASE_SSL_CA));
    }
});

// Runs one query over TLS with the given driver `ssl` option; resolves to the
// negotiated TLS version, or rejects. Same connection settings as db.js.
async function queryOverTls(ssl) {
    const url = new URL(process.env.DATABASE_URL);
    const client = new PrismaClient({
        adapter: new PrismaMariaDb({
            host: url.hostname,
            port: Number(url.port) || 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            connectionLimit: 1,
            acquireTimeout: 2000,
            ssl,
        }),
    });
    try {
        const [row] = await client.$queryRaw`SHOW SESSION STATUS LIKE 'Ssl_version'`;
        return row.Value;
    } finally {
        await client.$disconnect();
    }
}

test("DATABASE_SSL=true rejects a database certificate that is not trusted", async (t) => {
    // The local MySQL presents its auto-generated self-signed certificate.
    // Control (test only, never configurable in the app): without verification
    // the same server accepts TLS, so a failure below is the certificate check.
    const tls = await queryOverTls({ rejectUnauthorized: false }).catch(() => null);
    if (!tls) return t.skip("local MySQL does not offer TLS");
    assert.match(tls, /^TLSv1\.[23]$/);

    // Neither Node's CAs nor the unrelated test CA signed it: queries fail
    // (the pool reports a timeout), with no fallback to an unverified connection.
    for (const env of [{ DATABASE_SSL: "true" }, { DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA }]) {
        await assert.rejects(queryOverTls(databaseSsl(env)), /pool timeout/, JSON.stringify(Object.keys(env)));
    }

    // End to end: the app configured from the environment fails closed, and
    // logs why once (only the code), despite the pool's repeated retries.
    const server = await startServer({ DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA });
    try {
        assert.equal((await fetch(`${server.url}/health`)).status, 503, server.output());
        const output = server.output();
        assert.equal(output.match(/Database connection error: SELF_SIGNED_CERT_IN_CHAIN\n/g)?.length, 1, output);
        assert.ok(!output.includes(readFileSync(TEST_CA, "utf8").split("\n")[1]), "certificate contents were printed");
        for (const secret of ["fixtures", "test-ca", decodeURIComponent(new URL(process.env.DATABASE_URL).password)]) {
            assert.ok(!output.includes(secret), "CA path or password was printed");
        }
    } finally {
        await server.stop();
    }
});

test("connection error logger: fatal errors by code only, repeats suppressed, query errors ignored", () => {
    const lines = [];
    let clock = 0;
    const log = createConnectionErrorLogger((line) => lines.push(line), () => clock);

    // A query error (not fatal) carries row data in its message: never logged.
    log({ fatal: false, code: "ER_DUP_ENTRY", message: "Duplicate entry 'someone@example.com'" });
    log({ fatal: true, code: "SELF_SIGNED_CERT_IN_CHAIN", message: "self-signed certificate (host db.internal)" });
    log({ fatal: true, code: "SELF_SIGNED_CERT_IN_CHAIN" });
    clock = 30_000;
    log({ fatal: true, code: "SELF_SIGNED_CERT_IN_CHAIN" });
    log({ fatal: true, code: "ER_ACCESS_DENIED_ERROR", message: "Access denied for user 'shop'@'10.0.0.5'" });
    clock = 91_000;
    log({ fatal: true, code: "ER_ACCESS_DENIED_ERROR" });
    log({ fatal: true, code: "not a code; DROP" });
    log({ fatal: true });

    assert.deepEqual(lines, [
        "Database connection error: SELF_SIGNED_CERT_IN_CHAIN",
        "Database connection error: ER_ACCESS_DENIED_ERROR",
        "Database connection error: ER_ACCESS_DENIED_ERROR",
        "Database connection error: UNKNOWN",
    ]);
});

test("migrations: DATABASE_SSL=true forces sslaccept=strict and the CA on the migration URL", () => {
    const base = "mysql://user:p%40ss@db.example.com:3306/shop";

    // Off, or unset: the URL is passed through untouched (local development).
    for (const DATABASE_SSL of [undefined, "", "false"]) {
        assert.equal(migrationDatabaseUrl(base, { DATABASE_SSL }), base);
    }

    const strict = new URL(migrationDatabaseUrl(base, { DATABASE_SSL: "true" }));
    assert.equal(strict.searchParams.get("sslaccept"), "strict");
    assert.equal(strict.searchParams.has("sslcert"), false);
    assert.equal(strict.password, "p%40ss");

    // Weaker settings already on the URL are replaced, never kept.
    const replaced = new URL(migrationDatabaseUrl(`${base}?sslaccept=accept_invalid_certs&sslcert=old.pem`, { DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA }));
    assert.equal(replaced.searchParams.get("sslaccept"), "strict");
    assert.equal(replaced.searchParams.get("sslcert"), TEST_CA);

    assert.throws(() => migrationDatabaseUrl(base, { DATABASE_SSL: "TRUE" }), /DATABASE_SSL must be "true" or "false"/);
});

test("migrations: ssl* parameters on DATABASE_URL cannot override the DATABASE_SSL policy", () => {
    const base = "mysql://user:pass@localhost:3306/shop";
    const rejected = /DATABASE_URL must not set TLS parameters/;

    // Ordinary local URLs (no ssl* parameters, other parameters kept) still work.
    for (const env of [{}, { DATABASE_SSL: "false" }, { NODE_ENV: "development" }, { NODE_ENV: "test" }]) {
        assert.equal(migrationDatabaseUrl(base, env), base);
        assert.equal(migrationDatabaseUrl(`${base}?connection_limit=5`, env), `${base}?connection_limit=5`);
    }

    // TLS off (explicitly or unset): every ssl* parameter is rejected, including
    // fail-open sslaccept values and ones that would quietly turn TLS on.
    const offParams = [
        "sslaccept=accept_invalid_certs",
        "sslaccept=strict",
        "sslcert=ca.pem",
        "sslidentity=client.p12&sslpassword=hunter2-secret",
        "SSLACCEPT=strict",
        "sslmode=require",
    ];
    for (const env of [{}, { DATABASE_SSL: "false" }, { NODE_ENV: "development" }]) {
        for (const params of offParams) {
            assert.throws(() => migrationDatabaseUrl(`${base}?${params}`, env), rejected, `${params} with ${JSON.stringify(env)}`);
        }
    }

    // Only names are reported: sslpassword's value is a secret.
    assert.throws(() => migrationDatabaseUrl(`${base}?sslidentity=client.p12&sslpassword=hunter2-secret`, {}), (error) =>
        error.message.includes("sslidentity, sslpassword") && !/hunter2|client\.p12/.test(error.message));

    // TLS on: exact sslaccept/sslcert are overwritten (checked above); anything
    // else ssl* is still rejected, since the policy comes only from DATABASE_SSL.
    for (const params of ["sslidentity=client.p12", "sslpassword=x", "SSLACCEPT=accept_invalid_certs", "SslCert=other.pem", "sslmode=disable"]) {
        assert.throws(() => migrationDatabaseUrl(`${base}?${params}`, { DATABASE_SSL: "true" }), rejected, params);
    }

    // Production keeps its explicit requirement here too.
    assert.throws(() => migrationDatabaseUrl(base, { NODE_ENV: "production" }), /DATABASE_SSL is required in production/);
    assert.equal(migrationDatabaseUrl(base, { NODE_ENV: "production", DATABASE_SSL: "false" }), base);
    assert.equal(new URL(migrationDatabaseUrl(base, { NODE_ENV: "production", DATABASE_SSL: "true" })).searchParams.get("sslaccept"), "strict");
});

test("migrations: prisma migrate status verifies the database certificate when DATABASE_SSL=true", async (t) => {
    const migrateStatus = (env) => runNode(["node_modules/prisma/build/index.js", "migrate", "status"], env, 60000);

    const plain = await migrateStatus({ DATABASE_SSL: "false" });
    assert.equal(plain.code, 0, plain.output);
    assert.match(plain.output, /Database schema is up to date/);

    // With TLS off, a fail-open sslaccept on the URL stops the CLI before it connects.
    const failOpen = new URL(process.env.DATABASE_URL);
    failOpen.searchParams.set("sslaccept", "accept_invalid_certs");
    const blocked = await migrateStatus({ DATABASE_SSL: "false", DATABASE_URL: failOpen.toString() });
    assert.notEqual(blocked.code, 0, blocked.output);
    assert.match(blocked.output, /DATABASE_URL must not set TLS parameters \(sslaccept\)/);
    assert.doesNotMatch(blocked.output, /up to date/);
    assert.ok(!blocked.output.includes(decodeURIComponent(failOpen.password)), "password was printed");

    if (!(await queryOverTls({ rejectUnauthorized: false }).catch(() => null))) {
        return t.skip("local MySQL does not offer TLS");
    }

    // The local self-signed certificate must be rejected, with or without the
    // unrelated CA, even when DATABASE_URL itself asks for accept_invalid_certs.
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set("sslaccept", "accept_invalid_certs");

    for (const env of [{ DATABASE_SSL: "true" }, { DATABASE_SSL: "true", DATABASE_SSL_CA: TEST_CA, DATABASE_URL: url.toString() }]) {
        const { code, output } = await migrateStatus(env);
        assert.equal(code, 1, output);
        assert.match(output, /P1011: Error opening a TLS connection/);
        assert.ok(!output.includes(decodeURIComponent(url.password)), "password was printed");
    }
});

test("13. seed refuses to run outside development/test, before touching the database", async () => {
    const watched = { where: { email: "customer@example.com" }, select: { passwordHash: true, updatedAt: true } };
    const userBefore = await prisma.user.findUnique(watched);
    const stockBefore = await prisma.productVariant.findMany({ select: { id: true, stock: true }, orderBy: { id: "asc" } });

    for (const NODE_ENV of ["production", "staging"]) {
        const { code, output } = await runNode(["prisma/seed.js"], { NODE_ENV });
        assert.equal(code, 1, output);
        assert.match(output, /Refusing to seed/);
        assert.doesNotMatch(output, /Seed complete/);
    }

    assert.deepEqual(await prisma.user.findUnique(watched), userBefore, "user password/updatedAt unchanged");
    assert.deepEqual(await prisma.productVariant.findMany({ select: { id: true, stock: true }, orderBy: { id: "asc" } }), stockBefore, "stock unchanged");
    await prisma.$disconnect();
});
