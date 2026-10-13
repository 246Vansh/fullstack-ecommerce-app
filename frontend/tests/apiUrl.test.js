// VITE_API_URL validation (src/config/apiUrl.js), as used by vite.config.js.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { apiUrlErrors } from "../src/config/apiUrl.js";

const production = { development: false };
const development = { development: true };

test("valid production URLs are accepted", () => {
    for (const url of ["https://api.shop.example.com/api", "https://shop.example.com/api/", "https://shop.example.com/backend/api", "https://api.shop.example.com:8443/api"]) {
        assert.deepEqual(apiUrlErrors(url, production), [], url);
    }
});

test("missing or blank values fail in every mode", () => {
    for (const value of [undefined, "", "   "]) {
        for (const mode of [production, development]) {
            assert.match(apiUrlErrors(value, mode).join(), /VITE_API_URL is required/);
        }
    }
});

test("relative, non-http and malformed URLs fail", () => {
    for (const url of ["/api", "api.shop.example.com/api", "ftp://shop.example.com/api", "not a url"]) {
        assert.match(apiUrlErrors(url, development).join(), /absolute http\(s\) URL/, url);
    }
});

test("the /api base path is required", () => {
    for (const url of ["https://api.shop.example.com", "https://api.shop.example.com/", "https://api.shop.example.com/v1", "https://api.shop.example.com/apis"]) {
        assert.match(apiUrlErrors(url, production).join(), /must end with the \/api base path/, url);
    }
});

test("credentials, query strings and fragments are rejected", () => {
    for (const url of ["https://user:pw@api.shop.example.com/api", "https://api.shop.example.com/api?x=1", "https://api.shop.example.com/api#x"]) {
        assert.match(apiUrlErrors(url, production).join(), /must not contain credentials/, url);
    }
});

test("localhost and plain http are development-only", () => {
    for (const url of ["http://localhost:5000/api", "http://127.0.0.1:5000/api", "http://[::1]:5000/api", "http://app.localhost/api"]) {
        assert.deepEqual(apiUrlErrors(url, development), [], url);
        assert.match(apiUrlErrors(url, production).join(), /must not point to localhost/, url);
    }
    assert.deepEqual(apiUrlErrors("http://192.168.1.20:5000/api", development), []);
    assert.match(apiUrlErrors("http://api.shop.example.com/api", production).join(), /must use https/);
    assert.match(apiUrlErrors("https://localhost/api", production).join(), /must not point to localhost/);
});
