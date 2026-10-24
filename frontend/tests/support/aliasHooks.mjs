// Module resolve hooks for tests of src/ files, which use Vite's resolution:
// the "@/" alias and imports without a ".js" extension. "@/config/api" reads
// import.meta.env, which only Vite provides, so it is replaced by a fixed test
// config. Registered by tests/support/alias.js.
const API_CONFIG = "data:text/javascript,export const API_CONFIG = { baseURL: 'http://api.test/api', timeout: 1000, withCredentials: true };";

const SRC = new URL("../../src/", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
    if (specifier === "@/config/api") return { url: API_CONFIG, shortCircuit: true };

    const fromSrc = context.parentURL?.startsWith(SRC);
    const target = specifier.startsWith("@/") ? `${SRC}${specifier.slice(2)}`
        : fromSrc && specifier.startsWith(".") ? new URL(specifier, context.parentURL).href
        : null;

    if (target === null) return nextResolve(specifier, context);

    for (const candidate of [target, `${target}.js`, `${target}/index.js`]) {
        try {
            return await nextResolve(candidate, context);
        } catch {
            // try the next form
        }
    }

    return nextResolve(target, context);
}
