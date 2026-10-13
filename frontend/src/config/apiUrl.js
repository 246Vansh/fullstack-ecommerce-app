// Checks VITE_API_URL, the API base URL compiled into the bundle (see
// config/api.js). Used by vite.config.js, so a bad value stops the dev server
// or build instead of producing an app whose every request fails. No
// import.meta.env here: this module also runs in Node.
//
// Always: an absolute http(s) URL ending in the /api base path, without
// credentials, query or fragment, e.g. https://api.shop.example.com/api.
// Unless `development` is true (only the dev server, `vite`; never a build,
// whatever its --mode): https only, and never a local address.

const LOCAL_HOSTS = /^(localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$|\.localhost$/i;

const EXAMPLE = "e.g. https://api.shop.example.com/api";

// Returns a list of problems; empty when the value is usable.
export function apiUrlErrors(value, { development }) {
    if (!value || !String(value).trim()) {
        return [`VITE_API_URL is required (${EXAMPLE})`];
    }

    let url;

    try {
        url = new URL(value);
    } catch {
        return [`VITE_API_URL must be an absolute http(s) URL (${EXAMPLE})`];
    }

    const errors = [];

    if (!["http:", "https:"].includes(url.protocol)) {
        errors.push(`VITE_API_URL must be an absolute http(s) URL (${EXAMPLE})`);
    }

    if (!/\/api\/?$/.test(url.pathname)) {
        errors.push(`VITE_API_URL must end with the /api base path (${EXAMPLE})`);
    }

    if (url.username || url.password || url.search || url.hash) {
        errors.push("VITE_API_URL must not contain credentials, a query or a fragment");
    }

    if (!development) {
        if (url.protocol !== "https:") {
            errors.push("VITE_API_URL must use https in a build (http is only for the dev server)");
        }
        if (LOCAL_HOSTS.test(url.hostname)) {
            errors.push("VITE_API_URL must not point to localhost in a build (any --mode); set the production API URL");
        }
    }

    return errors;
}
