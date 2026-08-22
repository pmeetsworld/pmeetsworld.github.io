import test from "node:test";
import assert from "node:assert/strict";
import { parseLegacyRosterBackup } from "../src/domain/legacy.js";

test("legacy roster uses permanent account-number identities and route order", () => {
  const parsed = parseLegacyRosterBackup({
    exportedAt: "2026-05-03T12:00:00.000Z",
    roster: [
      {
        id: "#50188",
        name: "CASEY'S KEARNEY #2038",
        nick: "CASEY'S W 24TH ST",
        type: "C",
        freq: "W",
        days: ["mon"],
        order: { mon: 2 }
      },
      {
        id: "#50235",
        name: "LITTLE USA",
        nick: "",
        type: "I",
        freq: "W",
        days: ["mon"],
        order: { mon: 0 }
      },
      {
        id: "#50496",
        name: "WALMART LEXINGTON #637",
        nick: "",
        type: "C",
        freq: "W",
        days: ["wed", "fri"],
        order: { wed: 0, fri: 10 }
      }
    ]
  }, "2026-07-28T12:00:00.000Z");

  assert.equal(parsed.accountCount, 3);
  assert.equal(parsed.accounts.acct_50188.accountNumber, "50188");
  assert.equal(parsed.accounts.acct_50188.storeNumber, "2038");
  assert.equal(parsed.accounts.acct_50496.frequency, "Twice Weekly");
  assert.deepEqual(parsed.routes.mon, ["acct_50235", "acct_50188"]);
  assert.deepEqual(parsed.routes.wed, ["acct_50496"]);
  assert.deepEqual(parsed.routes.fri, ["acct_50496"]);
});

test("legacy roster rejects duplicate account numbers", () => {
  assert.throws(() => parseLegacyRosterBackup({
    roster: [
      { id: "#10", name: "One", days: [] },
      { id: "10", name: "Two", days: [] }
    ]
  }), /appears more than once/);
});
