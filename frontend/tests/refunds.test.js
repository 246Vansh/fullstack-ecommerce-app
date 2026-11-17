// Admin refund breakdown helpers (src/utils/refunds.js).
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { acknowledgementFor, formatMinor, refundRecordRows, refundSummaryRows } from "../src/utils/refunds.js";

const partial = {
    capturedAmount: 1000000, refundedAmount: 200000, netRetained: 800000, refundState: "PARTIAL", currency: "INR",
    refundCount: 2, anomalies: ["CURRENCY_MISMATCH"],
    refunds: [
        { razorpayRefundId: "rfnd_A", amount: 200000, currency: "INR", counted: true, receivedAt: "2026-11-17T10:00:00.000Z", emailStatus: "SENT" },
        { razorpayRefundId: "rfnd_B", amount: 500, currency: "USD", counted: false, receivedAt: "2026-11-17T11:00:00.000Z", emailStatus: "RETRYING" },
    ],
};

test("minor units are shown in major units of their own currency", () => {
    assert.match(formatMinor(1000000, "INR"), /10,000\.00/);
    assert.match(formatMinor(4000, "USD"), /\$40\.00/);
});

test("summary: captured, refunded and net amounts, state and anomaly messages", () => {
    const rows = refundSummaryRows(partial);
    assert.match(rows.captured, /10,000\.00/);
    assert.match(rows.refunded, /2,000\.00/);
    assert.match(rows.net, /8,000\.00/);
    assert.equal(rows.state, "Partially refunded");
    assert.equal(rows.anomalies.length, 1);
    assert.match(rows.anomalies[0], /different currency/);
    assert.equal(refundSummaryRows(null), null);
});

test("records: one row per refund with its own currency, counted flag and email state", () => {
    const rows = refundRecordRows(partial);
    assert.deepEqual(rows.map((r) => [r.id, r.counted, r.email, r.resendable]), [
        ["rfnd_A", true, "Email sent", false],
        ["rfnd_B", false, "Email failed; retrying", false],
    ]);
    assert.equal(refundRecordRows({ refunds: [{ ...partial.refunds[0], emailStatus: "GAVE_UP" }] })[0].resendable, true);
    assert.match(rows[1].amount, /\$5\.00/);
    assert.deepEqual(refundRecordRows(undefined), []);
});

test("acknowledgement sends back exactly the state that was shown", () => {
    assert.deepEqual(acknowledgementFor(partial), { refundCount: 2, refundedAmount: 200000 });
});
