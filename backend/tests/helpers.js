// Starts backend/server.js as a child process on its own port, so each test
// file gets a fresh in-memory rate-limit store. Uses the development database
// from .env; tests only read seed data and create/revoke their own tokens.
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const BACKEND_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// A port the OS reports as free right now.
export function freePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer().once("error", reject).listen(0, () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

export const CUSTOMER = { email: "customer@example.com", password: "Customer@12345" };

// Runs a node script in the backend dir; resolves with { code, output }.
export function runNode(args, env = {}, timeoutMs = 20000) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd: BACKEND_DIR, env: { ...process.env, ...env } });
        let output = "";
        child.stdout.on("data", (d) => { output += d; });
        child.stderr.on("data", (d) => { output += d; });
        const timer = setTimeout(() => child.kill(), timeoutMs);
        child.on("exit", (code) => { clearTimeout(timer); resolve({ code, output }); });
    });
}

export async function startServer(env = {}) {
    const port = await freePort();
    const child = spawn(process.execPath, ["server.js"], {
        cwd: BACKEND_DIR,
        env: { ...process.env, ...env, PORT: String(port) },
    });

    let output = "";
    child.stdout.on("data", (d) => { output += d; });
    child.stderr.on("data", (d) => { output += d; });

    const url = `http://127.0.0.1:${port}/api`;

    // Ready only when this child says it is listening (not just any server on the port).
    for (let i = 0; !output.includes(`Server running on port ${port}`); i++) {
        if (child.exitCode !== null || i > 150) {
            child.kill();
            throw new Error(`Server did not start:\n${output}`);
        }
        await new Promise((ok) => setTimeout(ok, 100));
    }

    return {
        url,
        output: () => output,
        stop: () => new Promise((ok) => { child.once("exit", ok); child.kill(); }),
    };
}

// Value of the refreshToken cookie in a response ("" when cleared, null if absent).
export function refreshCookie(res) {
    const header = res.headers.getSetCookie().find((c) => c.startsWith("refreshToken="));
    return header === undefined ? null : decodeURIComponent(header.split(";")[0].slice("refreshToken=".length));
}

export const setCookieHeader = (res) => res.headers.getSetCookie().find((c) => c.startsWith("refreshToken=")) ?? "";

export function post(url, body, { cookie, headers = {} } = {}) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookie !== undefined && { Cookie: `refreshToken=${encodeURIComponent(cookie)}` }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export async function login(url, credentials = CUSTOMER, extra = {}) {
    const res = await post(`${url}/auth/login`, { ...credentials, ...extra });
    return { res, body: await res.json(), token: refreshCookie(res) };
}
