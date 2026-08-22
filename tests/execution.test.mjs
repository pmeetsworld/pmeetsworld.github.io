import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  calculatePfp,
  parseDataFile,
  preorderStateId,
  projectPfpScorecard,
  stageDataReport,
  volumePayoutFactor
} from "../src/domain/execution.js";
import { createEmptyFieldState, createEmptyReportState } from "../src/state/schema.js";

function textFile(name, text) {
  return {
    name,
    size: Buffer.byteLength(text),
    text: async () => text
  };
}

test("PFP volume curve follows the 70 percent gate, ramp, accelerator, and cap", () => {
  assert.equal(volumePayoutFactor(0.69), 0);
  assert.equal(volumePayoutFactor(0.7), 0.25);
  assert.equal(volumePayoutFactor(1), 1);
  assert.ok(Math.abs(volumePayoutFactor(1.1) - 1.15) < 0.000001);
  assert.equal(volumePayoutFactor(1.2), 1.3);
  assert.equal(volumePayoutFactor(1.5), 1.3);
});

test("August 22 PFP snapshot uses current source attainment and validated execution", async () => {
  const text = await fs.readFile(new URL("../data/pfp-2026-08-22.json", import.meta.url), "utf8");
  const parsed = await parseDataFile(textFile("pfp-2026-08-22.json", text));
  const calculated = calculatePfp(parsed);
  assert.ok(calculated.volumePay > 0);
  assert.equal(calculated.executionAttainment, 5 / 78);
  assert.equal(calculated.buckets.find((bucket) => bucket.id === "premium").actual, 4448.85);
  assert.equal(calculated.campaigns.find((campaign) => campaign.name === "Ultra Distribution Scale Up - Aug PFP").completed, 2);
  assert.ok(calculated.estimatedPay > calculated.executionPay);
  assert.equal(calculated.isEstimate, true);
});

test("August 22 preorder snapshot keeps all products on stable item-number identities", async () => {
  const text = await fs.readFile(new URL("../data/preorders-2026-08-22.json", import.meta.url), "utf8");
  const parsed = await parseDataFile(textFile("preorders-2026-08-22.json", text));
  assert.equal(parsed.items.length, 17);
  assert.equal(new Set(parsed.items.map((item) => item.id)).size, 17);
  assert.ok(parsed.items.every((item) => item.itemNumber && item.id === `item:${item.itemNumber}`));
  assert.equal(parsed.items.find((item) => item.itemNumber === "11581").actual, 272);
});

test("PFP projection adds only locally completed assignments from exact PFP campaigns", () => {
  const source = calculatePfp({
    period: "August 2026",
    buckets: [],
    execution: { completed: 2, assigned: 4 },
    campaigns: [
      { name: "Campaign A", completed: 0, assigned: 2, type: "New distribution" },
      { name: "Already validated", completed: 2, assigned: 2, type: "Display" }
    ]
  });
  const field = createEmptyFieldState();
  field.eliteStates.eligible = { completedAt: "2026-08-20T12:00:00.000Z" };
  field.eliteStates.unrelated = { completedAt: "2026-08-20T12:00:00.000Z" };
  const report = createEmptyReportState();
  report.current.pfpScorecard = { scorecard: source };
  report.current.eliteAssignments = {
    accounts: {
      account: {
        items: [
          { id: "eligible", campaign: "Campaign A", sourceStatus: "To Do" },
          { id: "unrelated", campaign: "Another campaign", sourceStatus: "To Do" }
        ]
      }
    }
  };

  const projected = projectPfpScorecard(field, report);
  assert.equal(projected.sourceExecutionCompleted, 2);
  assert.equal(projected.localExecutionCompleted, 1);
  assert.equal(projected.execution.completed, 3);
  assert.equal(projected.sourceEstimatedPay, 300);
  assert.equal(projected.executionPay, 450);
  assert.equal(projected.localEstimatedLift, 150);
  assert.equal(projected.remainingPotential, 1050);
});

test("Perfect Launch CSV preserves all product context without inventing account links", async () => {
  const text = await fs.readFile(new URL("../data/perfect-launch-2026-08-17.csv", import.meta.url), "utf8");
  const parsed = await parseDataFile(textFile("perfect-launch-2026-08-17.csv", text));
  assert.equal(parsed.type, "perfectLaunchCatalog");
  assert.equal(parsed.items.length, 67);
  assert.ok(parsed.items.every((item) => item.skuKey.startsWith("name:")));
});

test("grouped Elite snapshot expands assignments and uncertain accounts stay in Review", async () => {
  const text = await fs.readFile(new URL("../data/elite-2026-08-22.json", import.meta.url), "utf8");
  const parsed = await parseDataFile(textFile("elite-2026-08-22.json", text));
  assert.equal(parsed.assignments.length, 122);

  const field = createEmptyFieldState();
  field.accounts.hanks = {
    id: "hanks",
    accountNumber: "10001",
    name: "Hanks Gas & Grocery",
    nickname: "Hanks",
    town: "Grand Island",
    storeNumber: "",
    type: "Independent"
  };
  const staged = stageDataReport(parsed, field, createEmptyReportState());
  assert.ok(staged.report.accounts.hanks.items.length > 0);
  assert.ok(staged.reviews.length > 0);
  assert.equal(staged.report.itemCount, 122);
});

test("Elite source-name variants matched to one account keep every assignment", () => {
  const field = createEmptyFieldState();
  field.accounts.hanks = {
    id: "hanks",
    accountNumber: "10001",
    name: "Hanks Gas & Grocery",
    nickname: "Hanks",
    town: "Grand Island",
    storeNumber: "",
    type: "Independent"
  };
  const parsed = {
    type: "eliteAssignments",
    fileName: "elite.json",
    importedAt: "2026-08-16T12:00:00.000Z",
    assignments: [
      { id: "task-1", sourceName: "Hanks Account 10001", title: "First task" },
      { id: "task-2", sourceName: "Hanks Gas Account 10001", title: "Second task" }
    ]
  };
  const staged = stageDataReport(parsed, field, createEmptyReportState());
  assert.equal(staged.report.accounts.hanks.items.length, 2);
  assert.equal(staged.report.itemCount, 2);
  assert.equal(staged.reviews.length, 0);
});

test("preorder responses have an account-scoped stable identity", () => {
  assert.equal(preorderStateId("acct-1", "item:11489"), "acct-1:item:11489");
  assert.notEqual(preorderStateId("acct-1", "item:11489"), preorderStateId("acct-2", "item:11489"));
});
