// Read-only: runs `prisma migrate status` against the dedicated test database.
//
//   pnpm db:test:status
//
// TEST_DATABASE_URL is read from .env (or the environment) by dotenv inside
// Node, so the password never passes through a shell: no export, no quoting,
// no Git Bash `!` history expansion. The URL is checked by the same guard the
// tests use and must name exactly ecommerce_test; it is then handed to the
// Prisma CLI as DATABASE_URL, which prisma.config.js reads (dotenv does not
// override a variable that is already set). URLs and passwords are never printed.
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testDatabaseGuard, CLEANUP_DATABASE, redactor } from "../tests/testDatabase.js";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const guard = testDatabaseGuard();
const refuse = (reason) => {
    console.error(`Refusing to run migrate status: ${reason}`);
    process.exit(1);
};

if (!guard.ok) refuse(guard.reason);
if (guard.database !== CLEANUP_DATABASE) {
    refuse(`TEST_DATABASE_URL names "${guard.database}", expected "${CLEANUP_DATABASE}"`);
}

console.log(`Checking migration status of "${guard.database}" (TEST_DATABASE_URL)`);

// Prisma's own errors (e.g. P1000) name the database user, sometimes only the
// part before an "@" in it, so hide the whole name and each such part.
const redactUrls = redactor(guard);
const user = decodeURIComponent(new URL(guard.url).username);
const userParts = [user, ...user.split("@")].filter((part) => part.length >= 3);
const redact = (text) => userParts.reduce((out, part) => out.split(part).join("<user>"), redactUrls(text));
const child = spawn(process.execPath, [path.join("node_modules", "prisma", "build", "index.js"), "migrate", "status"], {
    cwd: BACKEND_DIR,
    // DOTENV_CONFIG_OVERRIDE would let prisma.config.js's dotenv replace this
    // URL with the development one from .env; spawn drops undefined keys.
    env: { ...process.env, DATABASE_URL: guard.url, DOTENV_CONFIG_OVERRIDE: undefined },
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

child.on("close", (code) => {
    process.stdout.write(redact(output));

    // Prisma names the database it connected to; it must be the test database.
    const reported = /database "([^"]+)"/i.exec(output)?.[1];
    if (reported && reported !== CLEANUP_DATABASE) {
        console.error(`Prisma reported database "${reported}", not "${CLEANUP_DATABASE}"`);
        process.exit(1);
    }

    process.exit(code ?? 1);
});
