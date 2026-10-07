import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import prisma from "../config/db.js";
import { runNode } from "./helpers.js";

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
