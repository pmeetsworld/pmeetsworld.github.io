import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAccountHealth,
  computeSegmentPerformance,
  gradeFromScore,
  gradeStyle,
  reportOpportunitiesForAccount
} from "../src/domain/health.js";
import { COMPLIANCE_ITEMS } from "../src/config.js";
import { createEmptyFieldState, createEmptyReportState } from "../src/state/schema.js";

const SEGMENTS = ["Premium", "Mainstream", "Hard Beverage", "Non Alcohol", "High End"];

function addPerformance(report, deltas) {
  report.current.performance = {
    accounts: {
      a: {
        items: SEGMENTS.map((segment) => ({
          key: segment.toLowerCase(),
          name: segment,
          segment,
          ytdDelta: deltas[segment] ?? 0
        }))
      }
    }
  };
}

test("F is a real grade and never the no-data state", () => {
  assert.equal(gradeFromScore(0, true), "F");
  assert.equal(gradeFromScore(null, false), null);
  assert.notEqual(gradeStyle("F").fill, gradeStyle(null).fill);
});

test("an untouched account reports no-data rather than F", () => {
  const field = createEmptyFieldState();
  const report = createEmptyReportState();
  field.accounts.a = { id: "a", accountNumber: "1", name: "A" };
  const health = computeAccountHealth({ accountId: "a", field, report, asOf: "2026-07-27" });
  assert.equal(health.hasData, false);
  assert.equal(health.grade, null);
});

test("health reasons expose the signals behind the grade", () => {
  const field = createEmptyFieldState();
  const report = createEmptyReportState();
  field.accounts.a = { id: "a", accountNumber: "1", name: "A" };
  field.followUps.one = {
    id: "one",
    accountId: "a",
    title: "Old follow-up",
    dueDate: "2026-01-01",
    doneAt: null
  };
  const health = computeAccountHealth({ accountId: "a", field, report, asOf: "2026-07-27" });
  assert.equal(health.hasData, true);
  assert.ok(health.reasons.some((reason) => reason.includes("overdue follow-up")));
});

test("High End is ten percent of the segment-performance section", () => {
  const highEndDown = createEmptyReportState();
  addPerformance(highEndDown, { "High End": -1 });
  const regularDown = createEmptyReportState();
  addPerformance(regularDown, { Premium: -1 });

  assert.equal(computeSegmentPerformance(highEndDown, "a").score, 90);
  assert.equal(computeSegmentPerformance(regularDown, "a").score, 78);
});

test("segment performance contributes exactly twenty-five percent when field signals exist", () => {
  const field = createEmptyFieldState();
  const report = createEmptyReportState();
  field.accounts.a = { id: "a", accountNumber: "1", name: "A" };
  field.visits["a:2026-07-27"] = { id: "visit", accountId: "a", date: "2026-07-27" };
  field.compliance.a = Object.fromEntries(
    COMPLIANCE_ITEMS.map((item) => [item.id, { completedAt: "2026-07-27T12:00:00.000Z" }])
  );
  addPerformance(report, Object.fromEntries(SEGMENTS.map((segment) => [segment, -1])));

  const health = computeAccountHealth({ accountId: "a", field, report, asOf: "2026-07-27" });
  assert.equal(health.metrics.operationalScore, 100);
  assert.equal(health.metrics.segmentPerformance, 0);
  assert.equal(health.metrics.performanceWeight, 0.25);
  assert.equal(health.score, 75);
});

test("performance rows are not opportunity rows", () => {
  const report = createEmptyReportState();
  addPerformance(report, {});
  assert.deepEqual(reportOpportunitiesForAccount(report, "a"), []);
});

test("the same SKU across trackers counts as one account opportunity", () => {
  const report = createEmptyReportState();
  const item = {
    key: "name:nutrl pineapple",
    skuKey: "name:nutrl pineapple",
    name: "Nutrl Pineapple"
  };
  report.current.chainVoid = { accounts: { a: { items: [{ ...item }] } } };
  report.current.scaleUp = { accounts: { a: { items: [{ ...item, priority: "2 - High" }] } } };

  const opportunities = reportOpportunitiesForAccount(report, "a");
  assert.equal(opportunities.length, 1);
  assert.deepEqual(opportunities[0].reportTypes, ["chainVoid", "scaleUp"]);
});
