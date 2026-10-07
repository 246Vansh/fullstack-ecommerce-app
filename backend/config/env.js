// Validates the backend environment at startup. Importing this module checks
// process.env and exits with a readable list of problems; values are never
// printed, only variable names.

const NODE_ENVS = ["development", "production", "test"];
const SAME_SITE = ["lax", "strict", "none"];
const MIN_SECRET_LENGTH = 32;

function isUrl(value, protocols) {
    try {
        return protocols.includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

// TRUST_PROXY: unset/"false" = off (default), a hop count ("1"), or an
// Express trust list such as "loopback" or "10.0.0.0/8". "true" trusts every
// proxy, which lets clients spoof their IP, so it is rejected.
export function parseTrustProxy(value) {
    const raw = String(value ?? "").trim();

    if (raw === "" || raw === "false") return false;
    if (raw === "true") return undefined;
    if (/^\d+$/.test(raw)) return Number(raw);

    return raw;
}

export function validateEnv(env = process.env) {
    const errors = [];
    const required = (name) => {
        if (!env[name] || !String(env[name]).trim()) {
            errors.push(`${name} is required`);
            return false;
        }
        return true;
    };

    if (required("NODE_ENV") && !NODE_ENVS.includes(env.NODE_ENV)) {
        errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(", ")}`);
    }

    if (required("DATABASE_URL") && !isUrl(env.DATABASE_URL, ["mysql:", "mariadb:"])) {
        errors.push("DATABASE_URL must be a mysql:// or mariadb:// URL");
    }

    for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
        if (required(name) && env[name].length < MIN_SECRET_LENGTH) {
            errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
        }
    }

    if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
        errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
    }

    if (required("CLIENT_URL") && !isUrl(env.CLIENT_URL, ["http:", "https:"])) {
        errors.push("CLIENT_URL must be an http:// or https:// URL");
    }

    if (env.TRUST_PROXY !== undefined && parseTrustProxy(env.TRUST_PROXY) === undefined) {
        errors.push('TRUST_PROXY must be "false", a hop count such as "1", or a trusted address list (not "true")');
    }

    if (env.COOKIE_SAME_SITE && !SAME_SITE.includes(env.COOKIE_SAME_SITE)) {
        errors.push(`COOKIE_SAME_SITE must be one of: ${SAME_SITE.join(", ")}`);
    }

    if (env.COOKIE_SECURE && !["true", "false"].includes(env.COOKIE_SECURE)) {
        errors.push('COOKIE_SECURE must be "true" or "false"');
    }

    if (env.NODE_ENV === "production") {
        if (env.COOKIE_SECURE === "false") {
            errors.push("COOKIE_SECURE cannot be false in production");
        }
        if (env.CLIENT_URL && isUrl(env.CLIENT_URL, ["http:"]) && !/^http:\/\/localhost(:\d+)?\/?$/.test(env.CLIENT_URL)) {
            errors.push("CLIENT_URL must use https in production");
        }
    }

    return errors;
}

const errors = validateEnv();

if (errors.length) {
    console.error(`Invalid configuration:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    process.exit(1);
}
