import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { allowedNodeEnvironmentFlags } from "node:process";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}

// The driver's `ssl` option. Off unless DATABASE_SSL=true (query parameters
// on DATABASE_URL are not read). When on, the server certificate is always
// verified and its hostname checked, against DATABASE_SSL_CA (a PEM file) if
// set, otherwise Node's built-in trusted CAs. There is no setting to skip it.
export function databaseSsl(env = process.env) {
    if (env.DATABASE_SSL !== "true") return undefined;

    return {
        rejectUnauthorized: true,
        ...(env.DATABASE_SSL_CA && { ca: readFileSync(env.DATABASE_SSL_CA, "utf8") }),
    };
}

// The pool retries failed connections and Prisma reports only "pool timeout",
// dropping the reason (e.g. a rejected certificate). This driver logger prints
// that reason for connection-level (fatal) errors only, and only the error
// code such as SELF_SIGNED_CERT_IN_CHAIN or ER_ACCESS_DENIED_ERROR: messages
// can contain SQL, row data or hosts. Each code is repeated at most once a minute.
const REPEAT_LOG_MS = 60 * 1000;

export function createConnectionErrorLogger(log = console.error, now = Date.now) {
    let last = { code: null, at: 0 };

    return (err) => {
        if (!err?.fatal) return;

        const code = /^[A-Z0-9_]{1,64}$/.test(err.code) ? err.code : "UNKNOWN";
        const at = now();

        if (code === last.code && at - last.at < REPEAT_LOG_MS) return;

        last = { code, at };
        log(`Database connection error: ${code}`);
    };
}

// mysql://USER:PASSWORD@HOST:PORT/DATABASE
const url = new URL(process.env.DATABASE_URL);
const ssl = databaseSsl();
const isTest = process.env.NODE_ENV === "test";

const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ...(isTest && { allowPublicKeyRetrieval: true }),
    connectionLimit: 10,
    ...(ssl && { ssl }),
    logger: { error: createConnectionErrorLogger() },
});

// Reuse one client across nodemon reloads in development.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
