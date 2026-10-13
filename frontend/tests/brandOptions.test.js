// Brand filter options (src/utils/brandOptions.js), built from
// GET /api/products/brands. Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { brandQueryNames, matchBrandSlugs, toBrandFilterOptions } from "../src/utils/brandOptions.js";

const api = [
    { slug: "apple", name: "Apple", names: ["Apple"], productCount: 14 },
    { slug: "hm", name: "H&M", names: ["H&M", "HM"], productCount: 4 },
    { slug: "levis", name: "Levi's", names: ["Levi's"], productCount: 3 },
];

test("API brands become options whose id is the URL slug", () => {
    assert.deepEqual(toBrandFilterOptions(api).map((o) => [o.id, o.slug, o.name]), [
        ["apple", "apple", "Apple"], ["hm", "hm", "H&M"], ["levis", "levis", "Levi's"],
    ]);
});

test("missing or blank entries are dropped; missing names fall back to the name", () => {
    const options = toBrandFilterOptions([null, {}, { slug: "x", name: "  " }, { slug: "", name: "Y" }, { slug: "z", name: "Zed" }]);

    assert.deepEqual(options, [{ id: "z", slug: "z", name: "Zed", names: ["Zed"] }]);
    assert.deepEqual(toBrandFilterOptions(undefined), []);
});

test("the API query sends every stored spelling of the selected brands", () => {
    const options = toBrandFilterOptions(api);

    assert.deepEqual(brandQueryNames(options, ["hm", "apple"]), ["Apple", "H&M", "HM"]);
    assert.deepEqual(brandQueryNames(options, []), []);
});

test("URL slugs resolve to options, including brands outside the old static list", () => {
    const options = toBrandFilterOptions(api);

    assert.deepEqual(matchBrandSlugs(options, ["apple"]), { ids: ["apple"], complete: true });
    assert.deepEqual(matchBrandSlugs(options, ["levis", "hm"]), { ids: ["hm", "levis"], complete: true });
});

test("an unknown slug marks the link incomplete (shown as filter not found)", () => {
    const options = toBrandFilterOptions(api);

    assert.deepEqual(matchBrandSlugs(options, ["apple", "no-such-brand"]), { ids: ["apple"], complete: false });
    assert.deepEqual(matchBrandSlugs(options, []), { ids: [], complete: true });
});
