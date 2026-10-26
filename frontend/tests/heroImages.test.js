// Homepage hero photo sets (src/constants/heroImages.js), which the hero
// rotates through every 6 seconds. Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { HERO_ROTATE_MS, heroImageSets } from "../src/constants/heroImages.js";

test("the hero rotates every 6 seconds through several sets of three photos", () => {
    assert.equal(HERO_ROTATE_MS, 6 * 1000);
    assert.ok(heroImageSets.length >= 2, "more than one set to rotate through");
    for (const set of heroImageSets) assert.equal(set.length, 3, "one photo per tile");
});

test("every photo is a distinct Unsplash photo with a unique id", () => {
    const photos = heroImageSets.flat();
    assert.equal(new Set(photos.map((p) => p.id)).size, photos.length, "unique ids");
    assert.equal(new Set(photos.map((p) => p.src)).size, photos.length, "no photo repeated");
    for (const { src } of photos) {
        assert.match(src, /^https:\/\/images\.unsplash\.com\/photo-[0-9]+-[0-9a-f]+$/, src);
    }
});

test("the photos replaced in the hero do not come back", () => {
    const sources = heroImageSets.flat().map((p) => p.src).join(" ");
    assert.ok(!sources.includes("photo-1521572163474-6864f9cf17ab"), "the man in a white tee");
    assert.ok(!sources.includes("photo-1489987707025-afc232f7ea0f"), "the rail of tees");
});
