import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRoutePerformance,
  canonicalSkuKey,
  detectReportType,
  matchAccount,
  opportunityStateId,
  parseReportMatrix
} from "../src/domain/reports.js";

const accounts = {
  a: {
    id: "a",
    accountNumber: "10001",
    name: "Casey's",
    nickname: "Casey's Kearney",
    town: "Kearney",
    storeNumber: "2711"
  },
  b: {
    id: "b",
    accountNumber: "10002",
    name: "Hanks Gas & Grocery",
    nickname: "Hanks",
    town: "Grand Island",
    storeNumber: ""
  }
};

test("matcher uses explicit account number first", () => {
  assert.deepEqual(
    matchAccount("Account 10001", accounts, {}),
    { status: "matched", accountId: "a", method: "account number" }
  );
});

test("matcher accepts a unique chain store number", () => {
  const result = matchAccount("CASEY'S - KEARNEY - #2711 - GI", accounts, {});
  assert.equal(result.status, "matched");
  assert.equal(result.accountId, "a");
  assert.equal(result.method, "store number");
});

test("matcher accepts an explicit one-digit chain store number", () => {
  const oneDigitAccounts = {
    c: {
      id: "c",
      accountNumber: "10003",
      name: "Pump & Pantry",
      town: "Cairo",
      storeNumber: "4"
    }
  };
  const result = matchAccount("PUMP & PANTRY - CAIRO - #4 - GI", oneDigitAccounts, {});
  assert.equal(result.status, "matched");
  assert.equal(result.accountId, "c");
  assert.equal(result.method, "store number");
});

test("matcher never auto-applies an uncertain name", () => {
  const result = matchAccount("Hanks Market - GI", accounts, {});
  assert.equal(result.status, "review");
  assert.ok(Array.isArray(result.suggestions));
});

test("report detector uses sheet names and headers", () => {
  assert.equal(
    detectReportType("ScaleUp Report", [["Customer Name / Void Type / Product Name"]]),
    "scaleUp"
  );
  assert.equal(
    detectReportType("Sheet1", [["Customer Name / Product Name", "Last Purchase Date"], ["Perfect Launch"]]),
    "perfectLaunch"
  );
  assert.equal(
    detectReportType("Customer Biggest Losers", [["Customer Name / Segment", "Case Equiv 2025"]]),
    "customerMovers"
  );
  assert.equal(
    detectReportType("Performance Review - Segment", [["Segment / Brand", "Month to Date 2026"]]),
    "segmentPerformance"
  );
});

test("segment performance remains a global hierarchy with MTD and YTD values", () => {
  const parsed = parseReportMatrix([
    [
      "Segment / Brand",
      "Case Equiv | Month to Date 2025",
      "Case Equiv | Month to Date 2026",
      "Case Equiv | Month to Date Percentage Difference",
      "Case Equiv | Year to Date 2025",
      "Case Equiv | Year to Date 2026",
      "Case Equiv | Year to Date Percentage Difference"
    ],
    ["Premium", 10, 12, 0.2, 100, 120, 0.2],
    ["Modelo", 4, 5, 0.25, 40, 50, 0.25],
    ["Mainstream", 8, 7, -0.125, 80, 70, -0.125],
    ["Bud Light", 2, 1, -0.5, 20, 10, -0.5]
  ], "Performance Review - Segment");

  assert.equal(parsed.type, "segmentPerformance");
  assert.equal(parsed.segments.length, 2);
  assert.equal(parsed.segments[0].mtdCurrent, 12);
  assert.equal(parsed.segments[0].items[0].name, "Modelo");
  assert.equal(parsed.metrics.supportsPeriodToggle, true);
});

test("performance parser maps MTD and YTD columns by header instead of position", () => {
  const parsed = parseReportMatrix([
    [
      "Chain / Customer Name / Segment",
      "Case Equiv | Year to Date Percentage Difference",
      "Case Equiv | Month to Date 2026",
      "Case Equiv | Year to Date 2025",
      "Case Equiv | Month to Date Percentage Difference",
      "Case Equiv | Year to Date 2026",
      "Case Equiv | Month to Date 2025"
    ],
    ["HANKS GAS & GROCERY - GI", -0.1, 9, 100, 0.5, 90, 6],
    ["Premium", -0.2, 4, 50, 1, 40, 2]
  ], "Customer Performance Summary 2");

  assert.equal(parsed.metrics.layout, "mtd-ytd");
  assert.equal(parsed.metrics.valueLabel, "2026 YTD cases");
  assert.deepEqual(parsed.groups[0].summary, {
    mtdPrevious: 6,
    mtdCurrent: 9,
    mtdDelta: 0.5,
    ytdPrevious: 100,
    ytdCurrent: 90,
    ytdDelta: -0.1
  });
  assert.equal(parsed.groups[0].items[0].ytdCurrent, 40);
});

test("performance parser retains confirmed independent and chain hierarchy", () => {
  const parsed = parseReportMatrix([
    [
      "Chain / Customer Name / Segment",
      "Case Equiv | Month to Date 2025",
      "Case Equiv | Month to Date 2026",
      "Case Equiv | Month to Date Percentage Difference",
      "Case Equiv | Year to Date 2025",
      "Case Equiv | Year to Date 2026",
      "Case Equiv | Year to Date Percentage Difference"
    ],
    ["Indys", 20, 22, 0.1, 100, 110, 0.1],
    ["HANKS GAS & GROCERY - GI", 10, 12, 0.2, 50, 55, 0.1],
    ["Premium", 10, 12, 0.2, 50, 55, 0.1],
    ["Walmart", 10, 10, 0, 50, 50, 0],
    ["WALMART - LEXINGTON - #637 - GI", 10, 10, 0, 50, 50, 0],
    ["Premium", 10, 10, 0, 50, 50, 0]
  ], "Customer Performance Summary 2");

  assert.equal(parsed.groups[0].accountType, "Independent");
  assert.equal(parsed.groups[1].accountType, "Chain");
});

test("performance parser supports explicit two-year Case Equiv comparisons", () => {
  const parsed = parseReportMatrix([
    [
      "Customer Name / Segment",
      "Chain",
      "Case Equiv 2025",
      "Case Equiv 2026",
      "Case Equiv Unit Difference",
      "Case Equiv Percentage Difference"
    ],
    ["HANKS GAS & GROCERY - GI", "Indys", 100, 90, -10, -0.1],
    ["Premium", "0", 50, 40, -10, -0.2]
  ], "Customer Biggest Losers");

  assert.equal(parsed.metrics.layout, "year-comparison");
  assert.equal(parsed.metrics.valueLabel, "2026 cases");
  assert.equal(parsed.metrics.comparisonLabel, "vs 2025");
  assert.equal(parsed.groups[0].summary.ytdPrevious, 100);
  assert.equal(parsed.groups[0].summary.ytdCurrent, 90);
  assert.equal(parsed.groups[0].summary.ytdDelta, -0.1);
  assert.equal(parsed.groups[0].items[0].ytdCurrent, 40);
});

test("performance parser rejects an unknown column layout", () => {
  assert.throws(
    () => parseReportMatrix([
      ["Customer Name / Segment", "Mystery value"],
      ["HANKS GAS & GROCERY - GI", 12]
    ], "Customer Performance"),
    /Performance columns are not recognized/
  );
});

test("hierarchical opportunity rows stay grouped under the account", () => {
  const parsed = parseReportMatrix([
    ["Customer Name / Void Type / Product Name", "Priority", "Last Purchase Date", "Last Purchase Qty", "VOIDS"],
    ["CASEY'S - KEARNEY - #2711 - GI", "0", "", "", "2"],
    ["Alcohol", "0", "", "", "2"],
    ["Cutwater Lemon Drop Martini", "1 - Urgent", "", "", "1"],
    ["Nutrl Pineapple", "2 - High", "", "", "1"]
  ], "ScaleUp Report");
  assert.equal(parsed.type, "scaleUp");
  assert.equal(parsed.groups.length, 1);
  assert.equal(parsed.groups[0].items.length, 2);
  assert.equal(parsed.groups[0].items[0].category, "Alcohol");
});

test("item number becomes the preferred SKU identity when supplied", () => {
  const parsed = parseReportMatrix([
    ["Customer Name / Product Name", "Item Number", "Last Purchase Date", "Last Purchase Qty", "VOIDS"],
    ["HANKS GAS & GROCERY - GI", "", "", "", "1"],
    ["Nutrl Pineapple", "001234", "", "", "1"]
  ], "Perfect Launch Report");
  assert.equal(parsed.groups[0].items[0].itemNumber, "001234");
  assert.equal(parsed.groups[0].items[0].skuKey, "item:001234");
});

test("name fallback is stable across tracker categories", () => {
  const chain = canonicalSkuKey({ name: "Nutrl Pineapple", itemNumber: "" });
  const scale = canonicalSkuKey({ name: "NUTRL Pineapple" });
  assert.equal(chain, scale);
  assert.equal(
    opportunityStateId("acct_100", { skuKey: chain }),
    opportunityStateId("acct_100", { skuKey: scale })
  );
});

test("route performance aggregates only the selected account type", () => {
  const field = {
    accounts: {
      a: { id: "a", type: "Independent" },
      b: { id: "b", type: "Chain" }
    }
  };
  const report = {
    current: {
      performance: {
        accounts: {
          a: {
            items: [{
              segment: "Premium",
              mtdPrevious: 10,
              mtdCurrent: 12,
              mtdDelta: 0.2,
              ytdPrevious: 100,
              ytdCurrent: 110,
              ytdDelta: 0.1
            }]
          },
          b: {
            items: [{
              segment: "Premium",
              mtdPrevious: 5,
              mtdCurrent: 3,
              mtdDelta: -0.4,
              ytdPrevious: 50,
              ytdCurrent: 40,
              ytdDelta: -0.2
            }]
          }
        }
      }
    }
  };

  const all = aggregateRoutePerformance({
    field,
    report,
    accountIds: ["a", "b"]
  });
  assert.equal(all.accountCount, 2);
  assert.equal(all.matchedCount, 2);
  assert.equal(all.segments[0].ytdCurrent, 150);
  assert.equal(Math.round(all.segments[0].ytdDelta * 100), 0);

  const independent = aggregateRoutePerformance({
    field,
    report,
    accountIds: ["a", "b"],
    accountType: "Independent"
  });
  assert.equal(independent.accountCount, 1);
  assert.equal(independent.matchedCount, 1);
  assert.equal(Math.round(independent.segments[0].ytdDelta * 100), 10);

  const monthToDate = aggregateRoutePerformance({
    field,
    report: {
      current: {
        performance: {
          metrics: {
            layout: "mtd-ytd",
            supportsPeriodToggle: true,
            mtdValueLabel: "2026 MTD cases",
            mtdComparisonLabel: "vs 2025 MTD",
            ytdValueLabel: "2026 YTD cases",
            ytdComparisonLabel: "vs 2025 YTD"
          },
          accounts: report.current.performance.accounts
        }
      }
    },
    accountIds: ["a", "b"],
    period: "mtd"
  });
  assert.equal(monthToDate.metrics.period, "mtd");
  assert.equal(monthToDate.metrics.valueLabel, "2026 MTD cases");
  assert.equal(monthToDate.segments[0].current, 15);
  assert.equal(Math.round(monthToDate.segments[0].delta * 100), 0);
});

test("route performance prefers confirmed report hierarchy while preserving specialized field types", () => {
  const field = {
    accounts: {
      independent: { id: "independent", type: "Chain" },
      onPrem: { id: "onPrem", type: "On-Premise" }
    }
  };
  const item = {
    segment: "Premium",
    ytdPrevious: 10,
    ytdCurrent: 12,
    ytdDelta: 0.2
  };
  const report = {
    current: {
      performance: {
        accounts: {
          independent: { accountType: "Independent", items: [item] },
          onPrem: { accountType: "Independent", items: [item] }
        }
      }
    }
  };

  assert.equal(aggregateRoutePerformance({
    field,
    report,
    accountIds: ["independent", "onPrem"],
    accountType: "Independent"
  }).accountCount, 1);
  assert.equal(aggregateRoutePerformance({
    field,
    report,
    accountIds: ["independent", "onPrem"],
    accountType: "On-Premise"
  }).accountCount, 1);
});
