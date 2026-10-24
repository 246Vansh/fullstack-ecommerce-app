// Import first in a test file that loads src/ modules using the "@/" alias.
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);
