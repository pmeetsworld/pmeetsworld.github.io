export const APP_NAME = "Alpenglow";
export const APP_VERSION = "1.1.0";
export const SCHEMA_VERSION = 3;

export const STORAGE_KEYS = Object.freeze({
  field: "alpenglow.field.v1",
  report: "alpenglow.report.v1",
  ui: "alpenglow.ui.v1"
});

export const DAY_DEFS = Object.freeze([
  { id: "mon", short: "Mon", label: "Monday", index: 1 },
  { id: "tue", short: "Tue", label: "Tuesday", index: 2 },
  { id: "wed", short: "Wed", label: "Wednesday", index: 3 },
  { id: "thu", short: "Thu", label: "Thursday", index: 4 },
  { id: "fri", short: "Fri", label: "Friday", index: 5 }
]);

export const NOTE_TYPES = Object.freeze([
  "General",
  "Opportunity",
  "Issue",
  "Follow Up",
  "Order"
]);

export const TASK_TYPES = Object.freeze([
  "General",
  "Elite",
  "Follow Up"
]);

export const COMPLIANCE_ITEMS = Object.freeze([
  { id: "price-tags", label: "Price tags up and correct" },
  { id: "out-of-code", label: "Out-of-code walk" },
  { id: "rebates", label: "Rebates up" },
  { id: "pocm", label: "POCM up" },
  { id: "merch-space", label: "Merch and space survey" }
]);

export const OPPORTUNITY_STATES = Object.freeze([
  "Open",
  "Pitched",
  "Sold In",
  "On Shelf",
  "Not in Set"
]);

export function normalizeOpportunityState(value) {
  const aliases = {
    "No Fit": "Not in Set",
    "Already in Account": "On Shelf"
  };
  const normalized = aliases[value] || value;
  return OPPORTUNITY_STATES.includes(normalized) ? normalized : "Open";
}

export function isOpenOpportunityState(value) {
  const normalized = normalizeOpportunityState(value);
  return normalized === "Open" || normalized === "Pitched";
}

export const PREORDER_STATES = Object.freeze([
  "Not discussed",
  "Shared",
  "Interested",
  "Ordered",
  "Declined",
  "Not suitable for account"
]);

export const REPORT_TYPES = Object.freeze({
  performance: {
    id: "performance",
    label: "Account Performance",
    sheetHint: "customer performance"
  },
  segmentPerformance: {
    id: "segmentPerformance",
    label: "Segment Performance",
    sheetHint: "performance review segment"
  },
  customerMovers: {
    id: "customerMovers",
    label: "Customer Movers",
    sheetHint: "customer biggest losers"
  },
  perfectLaunch: {
    id: "perfectLaunch",
    label: "Perfect Launch",
    sheetHint: "perfect launch"
  },
  scaleUp: {
    id: "scaleUp",
    label: "Scale Up",
    sheetHint: "scaleup"
  },
  chainVoid: {
    id: "chainVoid",
    label: "Chain Mod Voids",
    sheetHint: "chain void"
  },
  perfectLaunchCatalog: {
    id: "perfectLaunchCatalog",
    label: "Perfect Launch Catalog",
    sheetHint: "perfect launch csv"
  },
  eliteAssignments: {
    id: "eliteAssignments",
    label: "Elite Assignments",
    sheetHint: "elite snapshot json"
  },
  preorders: {
    id: "preorders",
    label: "Preorders",
    sheetHint: "preorder snapshot json"
  },
  pfpScorecard: {
    id: "pfpScorecard",
    label: "PFP Scorecard",
    sheetHint: "pfp snapshot json"
  }
});

export const ACCOUNT_TYPES = Object.freeze([
  "Independent",
  "Chain",
  "On-Premise",
  "DSD"
]);

export const FREQUENCIES = Object.freeze([
  "Weekly",
  "Twice Weekly",
  "Bi-Weekly",
  "Monthly"
]);
