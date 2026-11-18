// Admin user management helpers (src/utils/adminUserRules.js): list query
// parsing, search checks, status and role display, which actions a row
// offers, and confirmation wording. The server enforces every rule again.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    MAX_SEARCH_LENGTH, MAX_SEARCH_WORDS, accountStatus, apiParamsFrom, blockConfirmation, emptyListMessage, fullName,
    listQueryFrom, roleChangeCopy, roleLabel, searchError, unblockConfirmation, userActions,
} from "../src/utils/adminUserRules.js";

const user = (changes = {}) => ({
    id: 7, email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", role: "CUSTOMER",
    blockedAt: null, isDeleted: false, orderCount: 2, createdAt: "2026-11-01T10:00:00.000Z", ...changes,
});

// ------------------------------------------------------------ list query (the URL)

test("listQueryFrom keeps valid URL values and drops the rest", () => {
    assert.deepEqual(listQueryFrom({}), { page: 1, search: "", role: "", status: "" });
    assert.deepEqual(listQueryFrom({ page: "3", search: "  ada ", role: "ADMIN", status: "blocked" }),
        { page: 3, search: "ada", role: "ADMIN", status: "blocked" });

    for (const page of ["0", "-1", "abc", "1.5", "100001", ["2", "3"], undefined]) {
        assert.equal(listQueryFrom({ page }).page, 1, `page ${JSON.stringify(page)}`);
    }
    assert.equal(listQueryFrom({ role: "admin" }).role, "", "roles are case-sensitive, as the API's");
    assert.equal(listQueryFrom({ role: "SUPERADMIN" }).role, "");
    assert.equal(listQueryFrom({ status: "suspended" }).status, "");
    assert.equal(listQueryFrom({ status: ["active", "blocked"] }).status, "", "a repeated value is ignored");
    assert.equal(listQueryFrom({ search: "50%" }).search, "", "a search the API would refuse is dropped");
    assert.equal(listQueryFrom({ search: ["a", "b"] }).search, "");
});

test("apiParamsFrom sends only what is set", () => {
    assert.deepEqual(apiParamsFrom({ page: 1, search: "", role: "", status: "" }, 20), { page: 1, limit: 20 });
    assert.deepEqual(apiParamsFrom({ page: 2, search: "ada", role: "ADMIN", status: "deleted" }, 20),
        { page: 2, limit: 20, search: "ada", role: "ADMIN", status: "deleted" });
});

// ------------------------------------------------------------ search

test("searchError mirrors the API's search rules", () => {
    assert.equal(searchError(""), "");
    assert.equal(searchError("ada lovelace"), "");
    assert.equal(searchError("john_doe@example.com"), "", "underscores are fine");
    assert.equal(searchError("x".repeat(MAX_SEARCH_LENGTH)), "");
    assert.match(searchError("x".repeat(MAX_SEARCH_LENGTH + 1)), /at most 100 characters/);
    assert.match(searchError("50%"), /% or \\/);
    assert.match(searchError("a\\b"), /% or \\/);
    assert.equal(searchError(Array(MAX_SEARCH_WORDS).fill("w").join(" ")), "");
    assert.match(searchError(Array(MAX_SEARCH_WORDS + 1).fill("w").join(" ")), /at most 5 words/);
    assert.equal(searchError("   spaced    out   "), "", "extra spaces are not words");
});

// ------------------------------------------------------------ display

test("fullName, roleLabel and accountStatus", () => {
    assert.equal(fullName(user()), "Ada Lovelace");
    assert.equal(fullName(user({ lastName: "" })), "Ada");
    assert.equal(fullName(user({ firstName: "", lastName: "" })), "ada@example.com", "falls back to the email");

    assert.equal(roleLabel("ADMIN"), "Admin");
    assert.equal(roleLabel("CUSTOMER"), "Customer");

    assert.deepEqual(accountStatus(user()), { key: "active", label: "Active", tone: "success" });
    assert.deepEqual(accountStatus(user({ blockedAt: "2026-11-02T00:00:00.000Z" })), { key: "blocked", label: "Blocked", tone: "danger" });
    assert.deepEqual(accountStatus(user({ isDeleted: true })), { key: "deleted", label: "Deleted", tone: "neutral" });
    assert.equal(accountStatus(user({ isDeleted: true, blockedAt: "2026-11-02T00:00:00.000Z" })).key, "deleted", "deleted wins");
});

test("emptyListMessage explains filtered and unfiltered empty lists", () => {
    assert.match(emptyListMessage({ search: "", role: "", status: "" }), /no accounts/i);
    assert.match(emptyListMessage({ search: "ada", role: "", status: "" }), /no accounts match/i);
    assert.match(emptyListMessage({ search: "", role: "", status: "blocked" }), /no accounts match/i);
});

// ------------------------------------------------------------ row actions

test("userActions: customers can be blocked and promoted; blocked ones only unblocked", () => {
    assert.deepEqual(userActions(user(), 1), { isSelf: false, canBlock: true, canUnblock: false, canPromote: true, canDemote: false, reason: "" });

    const blocked = userActions(user({ blockedAt: "2026-11-02T00:00:00.000Z" }), 1);
    assert.equal(blocked.canUnblock, true);
    assert.equal(blocked.canBlock, false);
    assert.equal(blocked.canPromote, false, "never promote a blocked account");
});

test("userActions: admins can only be demoted, never blocked", () => {
    const admin = userActions(user({ role: "ADMIN" }), 1);
    assert.equal(admin.canDemote, true);
    assert.equal(admin.canBlock, false);
    assert.equal(admin.canPromote, false);
});

test("userActions: nothing on your own account or a deleted one", () => {
    const self = userActions(user({ id: 1, role: "ADMIN" }), 1);
    assert.deepEqual(self, { isSelf: true, canBlock: false, canUnblock: false, canPromote: false, canDemote: false, reason: "This is your account" });
    assert.equal(userActions(user({ id: 1 }), "1").isSelf, false, "ids are compared exactly, as the API sends numbers");

    const deleted = userActions(user({ isDeleted: true, blockedAt: "2026-11-02T00:00:00.000Z" }), 1);
    assert.equal(deleted.reason, "Deleted account");
    assert.ok(!deleted.canBlock && !deleted.canUnblock && !deleted.canPromote && !deleted.canDemote);

    // Not signed in yet (no current user): nothing is offered.
    assert.equal(userActions(user(), undefined).canBlock, false);
});

// ------------------------------------------------------------ confirmation wording

test("confirmations name the account and say what happens", () => {
    assert.match(blockConfirmation(user()), /^Block Ada Lovelace \(ada@example\.com\)\?/);
    assert.match(blockConfirmation(user()), /signed out/);
    assert.match(unblockConfirmation(user()), /^Unblock Ada Lovelace/);

    const promote = roleChangeCopy(user(), "ADMIN");
    assert.equal(promote.promoting, true);
    assert.match(promote.title, /Make Ada Lovelace an administrator/);
    assert.match(promote.acknowledgement, /full admin access/);
    assert.equal(promote.submitLabel, "Make admin");

    const demote = roleChangeCopy(user({ role: "ADMIN" }), "CUSTOMER");
    assert.equal(demote.promoting, false);
    assert.match(demote.title, /Remove admin access from Ada Lovelace/);
    assert.equal(demote.acknowledgement, "");
    assert.equal(demote.submitLabel, "Remove admin access");
});
