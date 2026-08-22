import test from "node:test";
import assert from "node:assert/strict";
import {
  availableHealthMonths,
  buildDaySummary
} from "../src/ui/screens/activity.js";
import { createEmptyFieldState } from "../src/state/schema.js";

test("daily summary groups specific work beneath each account", () => {
  const field = createEmptyFieldState();
  field.accounts.a = {
    id: "a",
    accountNumber: "4242",
    name: "Field Test Account",
    nickname: "Field Test",
    town: "Kearney"
  };
  field.routes.tue.push("a");
  field.visits["a:2026-07-28"] = {
    id: "a:2026-07-28",
    accountId: "a",
    date: "2026-07-28"
  };
  field.compliance.a = {
    "out-of-code": { completedAt: "2026-07-28T14:00:00.000Z" }
  };
  field.notes.n1 = {
    id: "n1",
    accountId: "a",
    type: "Order",
    body: "Bring in two cases next visit.",
    createdAt: "2026-07-28T15:00:00.000Z"
  };
  field.tasks.t1 = {
    id: "t1",
    accountId: "a",
    title: "Replace price cards",
    doneAt: "2026-07-28T16:00:00.000Z"
  };
  field.dayNotes["2026-07-28"] = "Good route execution.";

  const summary = buildDaySummary(field, "2026-07-28");

  assert.match(summary, /Field Test \(Acct 4242\)/);
  assert.match(summary, /- Visit completed/);
  assert.match(summary, /Compliance: Out-of-code walk/);
  assert.match(summary, /Note \(Order\): Bring in two cases next visit\./);
  assert.match(summary, /Task completed: Replace price cards/);
  assert.match(summary, /Manager context: Good route execution\./);
});

test("daily summary keeps only the final opportunity state for each item", () => {
  const field = createEmptyFieldState();
  field.accounts.a = { id: "a", name: "Field Test Account" };
  field.activity.push(
    { id: "1", type: "opportunity", accountId: "a", title: "SKU A", detail: "Sold In", createdAt: "2026-07-28T14:00:00.000Z" },
    { id: "2", type: "opportunity", accountId: "a", title: "SKU A", detail: "No Fit", createdAt: "2026-07-28T15:00:00.000Z" },
    { id: "3", type: "opportunity", accountId: "a", title: "SKU A", detail: "Open", createdAt: "2026-07-28T16:00:00.000Z" }
  );

  const summary = buildDaySummary(field, "2026-07-28");

  assert.match(summary, /- SKU A: Open/);
  assert.doesNotMatch(summary, /Sold In|Not in Set/);
});

test("route health month choices begin with the Alpenglow history era", () => {
  const field = createEmptyFieldState();
  field.healthLog["2026-05-04"] = { grade: "C" };
  field.healthLog["2026-07-28"] = { grade: "A" };
  const report = {
    snapshots: [
      { health: { days: { mon: { date: "2026-06-15", grade: "B" } } } },
      { health: { days: { fri: { date: "2026-08-07", grade: "A" } } } }
    ]
  };

  assert.deepEqual(
    availableHealthMonths(field, report, "2026-09"),
    ["2026-09", "2026-08", "2026-07"]
  );
});
