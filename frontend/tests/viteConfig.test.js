// vite.config.js applies the VITE_API_URL rules by command, not by --mode:
// only the dev server may use a local http URL; every build must get an https,
// non-local URL, so `vite build --mode development` cannot bypass the check.
// Run with: pnpm test
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import viteConfig from "../vite.config.js";

// loadEnv reads the .env files from the working directory; a VITE_API_URL
// in process.env overrides them, so each case sets it explicitly.
process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const original = process.env.VITE_API_URL;
afterEach(() => {
    if (original === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = original;
});

function run(env, url) {
    process.env.VITE_API_URL = url;
    return viteConfig({ isPreview: false, ...env });
}

const LOCAL = "http://localhost:5000/api";
const PRODUCTION_URL = "https://api.shop.example.com/api";

test("vite build --mode development cannot ship a localhost or http API URL", () => {
    assert.throws(() => run({ command: "build", mode: "development" }, LOCAL), /must not point to localhost in a build/);
    assert.throws(() => run({ command: "build", mode: "development" }, LOCAL), /must use https in a build/);
    assert.throws(() => run({ command: "build", mode: "development" }, "http://api.shop.example.com/api"), /must use https in a build/);
});

test("every build mode gets the production rules", () => {
    for (const mode of ["production", "development", "staging", "test"]) {
        assert.throws(() => run({ command: "build", mode }, LOCAL), /must not point to localhost/, mode);
        assert.throws(() => run({ command: "build", mode }, ""), /VITE_API_URL is required/, mode);
        assert.ok(run({ command: "build", mode }, PRODUCTION_URL).plugins, mode);
    }
});

test("the dev server still accepts a local http API URL", () => {
    assert.ok(run({ command: "serve", mode: "development" }, LOCAL).plugins);
    assert.ok(run({ command: "serve", mode: "development" }, "http://192.168.1.20:5000/api").plugins);
    assert.throws(() => run({ command: "serve", mode: "development" }, "http://localhost:5000"), /must end with the \/api base path/);
});

test("vite preview serves an existing build and is not checked", () => {
    assert.ok(run({ command: "serve", mode: "production", isPreview: true }, LOCAL).plugins);
});
