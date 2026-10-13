import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Migrations connect through Prisma's schema engine, which reads TLS settings
// only from DATABASE_URL parameters (the app itself uses DATABASE_SSL, see
// config/db.js). With DATABASE_SSL=true this applies the same policy:
// sslaccept=strict verifies the certificate chain and hostname, and sslcert
// names DATABASE_SSL_CA when set. Any other sslaccept value, including a typo
// or "STRICT", makes the engine accept invalid certificates, so it is replaced.
//
// TLS is configured only through DATABASE_SSL, so any other ssl* parameter on
// DATABASE_URL (sslidentity, sslpassword, a differently cased name, or any
// ssl* parameter while TLS is off) is rejected rather than passed to the
// engine. Only parameter names are reported, never values.
const OVERWRITTEN_TLS_PARAMS = ["sslaccept", "sslcert"];

export function migrationDatabaseUrl(databaseUrl, environment = process.env) {
    const { DATABASE_SSL, DATABASE_SSL_CA, NODE_ENV } = environment;

    if (DATABASE_SSL && !["true", "false"].includes(DATABASE_SSL)) {
        throw new Error('DATABASE_SSL must be "true" or "false"');
    }

    if (NODE_ENV === "production" && !DATABASE_SSL) {
        throw new Error('DATABASE_SSL is required in production: "true" (verified TLS) or "false"');
    }

    const url = new URL(databaseUrl);
    const tlsOn = DATABASE_SSL === "true";

    const conflicting = [...new Set(url.searchParams.keys())]
        .filter((name) => /^ssl/i.test(name) && !(tlsOn && OVERWRITTEN_TLS_PARAMS.includes(name)));

    if (conflicting.length) {
        throw new Error(`DATABASE_URL must not set TLS parameters (${conflicting.join(", ")}); `
            + "configure TLS with DATABASE_SSL and DATABASE_SSL_CA instead");
    }

    if (!tlsOn) return databaseUrl;

    url.searchParams.set("sslaccept", "strict");

    if (DATABASE_SSL_CA) {
        url.searchParams.set("sslcert", path.resolve(DATABASE_SSL_CA));
    } else {
        url.searchParams.delete("sslcert");
    }

    return url.toString();
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "node prisma/seed.js",
    },
    datasource: {
        url: migrationDatabaseUrl(env("DATABASE_URL")),
    },
});
