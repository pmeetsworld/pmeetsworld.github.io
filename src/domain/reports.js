import { REPORT_TYPES } from "../config.js?v=1.1.0";
import {
  canonicalSkuKey,
  normalizeText
} from "./identity.js?v=1.1.0";

export {
  canonicalSkuKey,
  normalizeIdentifier,
  normalizeText,
  opportunityStateId
} from "./identity.js?v=1.1.0";

const SEGMENTS = new Set([
  "premium",
  "mainstream",
  "hard beverage",
  "non alcohol",
  "high end"
]);

const CATEGORIES = new Set(["alcohol", "non alcohol"]);

const PERFORMANCE_ACCOUNT_TYPES = new Map([
  ["indys", "Independent"],
  ["indy", "Independent"],
  ["independent", "Independent"],
  ["independents", "Independent"],
  ["chain", "Chain"],
  ["chains", "Chain"],
  ["dsd", "DSD"],
  ["on prem", "On-Premise"],
  ["on premise", "On-Premise"],
  ["on premises", "On-Premise"]
]);

function hashText(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function sourceKey(value) {
  return normalizeText(value);
}

export function extractStoreNumber(value) {
  const text = String(value || "");
  const explicit = text.match(/#\s*(\d{1,6})\b/);
  if (explicit) return explicit[1];
  const trailing = text.match(/\s-\s(\d{3,6})\s-\sGI\s*$/i);
  return trailing ? trailing[1] : "";
}

export function extractAccountNumber(value) {
  const match = String(value || "").match(/\b(?:account|acct)\s*#?\s*(\d{2,12})\b/i);
  return match ? match[1] : "";
}

function sourceParts(value) {
  const rawParts = String(value || "")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^GI$/i.test(part));
  const withoutStore = rawParts.filter((part) => !/^#\d{1,6}$/.test(part) && !/^\d{3,6}$/.test(part));
  const town = withoutStore.length >= 2 ? normalizeText(withoutStore.at(-1)) : "";
  const name = withoutStore.length >= 2
    ? normalizeText(withoutStore.slice(0, -1).join(" "))
    : normalizeText(withoutStore[0] || value);
  return { name, town };
}

function candidateSourceKeys(account) {
  const values = new Set();
  const names = [account.name, account.nickname].filter(Boolean);
  for (const name of names) {
    values.add(normalizeText(name));
    if (account.town) values.add(normalizeText(`${name} ${account.town}`));
    if (account.storeNumber) {
      values.add(normalizeText(`${name} ${account.storeNumber}`));
      if (account.town) values.add(normalizeText(`${name} ${account.town} ${account.storeNumber}`));
    }
  }
  return values;
}

function suggestionsFor(source, accounts) {
  const wanted = new Set(normalizeText(source).split(" ").filter((token) => token.length > 2));
  return Object.values(accounts)
    .map((account) => {
      const tokens = new Set(normalizeText(`${account.name} ${account.nickname || ""} ${account.town || ""}`).split(" "));
      const overlap = [...wanted].filter((token) => tokens.has(token)).length;
      return { accountId: account.id, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((item) => item.accountId);
}

export function matchAccount(sourceName, accounts, links = {}) {
  const key = sourceKey(sourceName);
  if (links[key] && accounts[links[key]]) {
    return { status: "matched", accountId: links[key], method: "confirmed link" };
  }

  const accountNumber = extractAccountNumber(sourceName);
  if (accountNumber) {
    const exact = Object.values(accounts).filter((account) => String(account.accountNumber) === accountNumber);
    if (exact.length === 1) return { status: "matched", accountId: exact[0].id, method: "account number" };
  }

  const storeNumber = extractStoreNumber(sourceName);
  if (storeNumber) {
    const exact = Object.values(accounts).filter((account) => String(account.storeNumber) === storeNumber);
    if (exact.length === 1) return { status: "matched", accountId: exact[0].id, method: "store number" };
  }

  const normalizedMatches = Object.values(accounts).filter((account) => candidateSourceKeys(account).has(key));
  if (normalizedMatches.length === 1) {
    return { status: "matched", accountId: normalizedMatches[0].id, method: "exact name" };
  }

  const parts = sourceParts(sourceName);
  if (parts.town) {
    const exactNameTown = Object.values(accounts).filter((account) => {
      const townMatches = normalizeText(account.town) === parts.town;
      const accountNames = [account.name, account.nickname].filter(Boolean).map(normalizeText);
      return townMatches && accountNames.includes(parts.name);
    });
    if (exactNameTown.length === 1) {
      return { status: "matched", accountId: exactNameTown[0].id, method: "exact name and town" };
    }
  }

  return {
    status: "review",
    reason: storeNumber ? "Store number was not unique or was not found" : "No certain identifier match",
    suggestions: suggestionsFor(sourceName, accounts)
  };
}

function isAccountHeading(value) {
  return /\s-\sGI\s*$/i.test(String(value || "").trim());
}

function cleanRow(row) {
  return Array.from(row || [], (value) => value ?? "");
}

function excelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + value);
    return epoch.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function detectReportType(sheetName, matrix, fileName = "") {
  const haystack = normalizeText([
    sheetName,
    fileName,
    ...(matrix.slice(0, 3).flat())
  ].join(" "));
  if (haystack.includes("customer biggest losers")) return "customerMovers";
  if (
    haystack.includes("performance review segment") ||
    haystack.includes("segment performance")
  ) return "segmentPerformance";
  if (haystack.includes("customer performance")) return "performance";
  if (haystack.includes("perfect launch")) return "perfectLaunch";
  if (haystack.includes("scaleup") || haystack.includes("scale up")) return "scaleUp";
  if (haystack.includes("chain void")) return "chainVoid";
  throw new Error("This workbook does not match a supported Alpenglow report.");
}

function itemKey(name, itemNumber = "") {
  return canonicalSkuKey({ itemNumber, name });
}

function findColumn(header, patterns, fallback = -1) {
  const normalized = header.map(normalizeText);
  const index = normalized.findIndex((value) => patterns.some((pattern) => pattern.test(value)));
  return index >= 0 ? index : fallback;
}

const DEFAULT_PERFORMANCE_METRICS = Object.freeze({
  layout: "legacy-ytd",
  currentYear: null,
  previousYear: null,
  supportsPeriodToggle: false,
  mtdValueLabel: "MTD cases",
  mtdComparisonLabel: "vs prior MTD",
  ytdValueLabel: "YTD cases",
  ytdComparisonLabel: "vs prior YTD",
  valueLabel: "YTD cases",
  comparisonLabel: "vs prior YTD"
});

export function performanceMetrics(performance, requestedPeriod = "ytd") {
  const metrics = {
    ...DEFAULT_PERFORMANCE_METRICS,
    ...(performance?.metrics || {})
  };
  const period = metrics.supportsPeriodToggle && requestedPeriod === "mtd" ? "mtd" : "ytd";
  return {
    ...metrics,
    period,
    valueLabel: period === "mtd" ? metrics.mtdValueLabel : metrics.ytdValueLabel,
    comparisonLabel: period === "mtd" ? metrics.mtdComparisonLabel : metrics.ytdComparisonLabel
  };
}

function performanceYear(value) {
  const match = normalizeText(value).match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function performanceYearPair(columns) {
  const years = [...new Set(columns.map((column) => column.year).filter(Boolean))].sort((a, b) => a - b);
  if (years.length < 2) return null;
  const previousYear = years.at(-2);
  const currentYear = years.at(-1);
  return {
    previousYear,
    currentYear,
    previousIndex: columns.find((column) => column.year === previousYear)?.index ?? -1,
    currentIndex: columns.find((column) => column.year === currentYear)?.index ?? -1
  };
}

function performanceLayout(header) {
  const columns = header.map((value, index) => ({
    index,
    label: normalizeText(value),
    year: performanceYear(value)
  }));
  const isDifference = (column) => column.label.includes("difference");
  const ytdValues = columns.filter((column) => (
    column.label.includes("year to date") && column.year && !isDifference(column)
  ));
  const mtdValues = columns.filter((column) => (
    column.label.includes("month to date") && column.year && !isDifference(column)
  ));
  const ytdPair = performanceYearPair(ytdValues);
  const mtdPair = performanceYearPair(mtdValues);
  const ytdDeltaIndex = columns.find((column) => (
    column.label.includes("year to date") && column.label.includes("percentage difference")
  ))?.index ?? -1;
  const mtdDeltaIndex = columns.find((column) => (
    column.label.includes("month to date") && column.label.includes("percentage difference")
  ))?.index ?? -1;

  if (ytdPair && mtdPair && ytdDeltaIndex >= 0 && mtdDeltaIndex >= 0) {
    return {
      mtdPreviousIndex: mtdPair.previousIndex,
      mtdCurrentIndex: mtdPair.currentIndex,
      mtdDeltaIndex,
      ytdPreviousIndex: ytdPair.previousIndex,
      ytdCurrentIndex: ytdPair.currentIndex,
      ytdDeltaIndex,
      metrics: {
        layout: "mtd-ytd",
        currentYear: ytdPair.currentYear,
        previousYear: ytdPair.previousYear,
        supportsPeriodToggle: true,
        mtdValueLabel: `${mtdPair.currentYear} MTD cases`,
        mtdComparisonLabel: `vs ${mtdPair.previousYear} MTD`,
        ytdValueLabel: `${ytdPair.currentYear} YTD cases`,
        ytdComparisonLabel: `vs ${ytdPair.previousYear} YTD`,
        valueLabel: `${ytdPair.currentYear} YTD cases`,
        comparisonLabel: `vs ${ytdPair.previousYear} YTD`
      }
    };
  }

  const comparisonValues = columns.filter((column) => (
    column.label.includes("case equiv") && column.year && !isDifference(column)
  ));
  const comparisonPair = performanceYearPair(comparisonValues);
  const comparisonDeltaIndex = columns.find((column) => (
    column.label.includes("case equiv") && column.label.includes("percentage difference")
  ))?.index ?? -1;

  if (comparisonPair && comparisonDeltaIndex >= 0) {
    return {
      mtdPreviousIndex: -1,
      mtdCurrentIndex: -1,
      mtdDeltaIndex: -1,
      ytdPreviousIndex: comparisonPair.previousIndex,
      ytdCurrentIndex: comparisonPair.currentIndex,
      ytdDeltaIndex: comparisonDeltaIndex,
      metrics: {
        layout: "year-comparison",
        currentYear: comparisonPair.currentYear,
        previousYear: comparisonPair.previousYear,
        supportsPeriodToggle: false,
        ytdValueLabel: `${comparisonPair.currentYear} cases`,
        ytdComparisonLabel: `vs ${comparisonPair.previousYear}`,
        valueLabel: `${comparisonPair.currentYear} cases`,
        comparisonLabel: `vs ${comparisonPair.previousYear}`
      }
    };
  }

  throw new Error(
    "Performance columns are not recognized. Expected MTD/YTD columns or a two-year Case Equiv comparison."
  );
}

function numericCell(row, index) {
  if (index < 0 || row[index] === "" || row[index] === null || row[index] === undefined) return null;
  const number = Number(row[index]);
  return Number.isFinite(number) ? number : null;
}

function performanceValues(row, layout) {
  const ytdPrevious = numericCell(row, layout.ytdPreviousIndex) ?? 0;
  const ytdCurrent = numericCell(row, layout.ytdCurrentIndex) ?? 0;
  const suppliedYtdDelta = numericCell(row, layout.ytdDeltaIndex);
  return {
    mtdPrevious: numericCell(row, layout.mtdPreviousIndex) ?? 0,
    mtdCurrent: numericCell(row, layout.mtdCurrentIndex) ?? 0,
    mtdDelta: numericCell(row, layout.mtdDeltaIndex) ?? 0,
    ytdPrevious,
    ytdCurrent,
    ytdDelta: suppliedYtdDelta ?? (ytdPrevious ? (ytdCurrent - ytdPrevious) / ytdPrevious : 0)
  };
}

function parsePerformance(rows) {
  const layout = performanceLayout(rows[0] || []);
  const groups = [];
  let current = null;
  let currentAccountType = null;
  for (const row of rows.slice(1)) {
    const label = String(row[0] || "").trim();
    if (!label) continue;
    const normalized = normalizeText(label);
    const accountTypeHeading = PERFORMANCE_ACCOUNT_TYPES.get(normalized);
    if (accountTypeHeading) {
      currentAccountType = accountTypeHeading;
      current = null;
    } else if (normalized === "total") {
      current = null;
    } else if (isAccountHeading(label)) {
      current = {
        sourceName: label,
        accountType: currentAccountType,
        summary: performanceValues(row, layout),
        items: []
      };
      groups.push(current);
    } else if (current && SEGMENTS.has(normalized)) {
      const skuKey = itemKey(label);
      current.items.push({
        key: skuKey,
        skuKey,
        itemNumber: "",
        name: label,
        segment: label,
        ...performanceValues(row, layout)
      });
    } else if (!SEGMENTS.has(normalized)) {
      // In this report, any remaining parent row is a chain banner such as
      // Casey's or Walmart. Preserve that explicit hierarchy for filtering.
      currentAccountType = "Chain";
      current = null;
    }
  }
  return { groups, metrics: layout.metrics };
}

function parseSegmentPerformance(rows) {
  const layout = performanceLayout(rows[0] || []);
  const segments = [];
  let current = null;
  for (const row of rows.slice(1)) {
    const label = String(row[0] || "").trim();
    if (!label || normalizeText(label) === "total") continue;
    const normalized = normalizeText(label);
    if (SEGMENTS.has(normalized)) {
      current = {
        id: normalized,
        name: label,
        ...performanceValues(row, layout),
        items: []
      };
      segments.push(current);
    } else if (current) {
      current.items.push({
        id: `${current.id}:${normalizeText(label)}`,
        name: label,
        ...performanceValues(row, layout)
      });
    }
  }
  if (!segments.length) throw new Error("No segment rows were found in Segment Performance.");
  return { groups: [], segments, metrics: layout.metrics };
}

function parseOpportunityReport(rows, reportType) {
  const header = rows[0] || [];
  const priorityIndex = findColumn(header, [/^priority$/], reportType === "scaleUp" ? 1 : -1);
  const dateIndex = findColumn(header, [/^last purchase date$/], reportType === "scaleUp" ? 2 : 1);
  const quantityIndex = findColumn(header, [/^last purchase qty$/, /^last purchase quantity$/], reportType === "scaleUp" ? 3 : 2);
  const voidsIndex = findColumn(header, [/^voids?$/], reportType === "scaleUp" ? 4 : 3);
  const itemNumberIndex = findColumn(header, [
    /^item (?:number|no|id)$/,
    /^product (?:number|no|id)$/,
    /^sku(?: number| no| id)?$/
  ]);
  const groups = [];
  let current = null;
  let category = "";
  for (const row of rows.slice(1)) {
    const label = String(row[0] || "").trim();
    if (!label) continue;
    const normalized = normalizeText(label);
    if (isAccountHeading(label)) {
      current = {
        sourceName: label,
        summary: {
          lastPurchaseDate: excelDate(row[dateIndex]),
          lastPurchaseQty: Number(row[quantityIndex]) || 0,
          voids: Number(row[voidsIndex]) || 0
        },
        items: []
      };
      category = "";
      groups.push(current);
      continue;
    }
    if (!current) continue;
    if (CATEGORIES.has(normalized)) {
      category = label;
      continue;
    }
    const itemNumber = itemNumberIndex >= 0 ? String(row[itemNumberIndex] || "").trim() : "";
    const skuKey = itemKey(label, itemNumber);
    current.items.push({
      key: skuKey,
      skuKey,
      itemNumber,
      name: label,
      category,
      priority: priorityIndex >= 0 ? String(row[priorityIndex] || "") : "",
      lastPurchaseDate: excelDate(row[dateIndex]),
      lastPurchaseQty: Number(row[quantityIndex]) || 0,
      voids: Number(row[voidsIndex]) || 1
    });
  }
  return groups;
}

export function parseReportMatrix(matrix, sheetName = "", fileName = "") {
  const rows = matrix.map(cleanRow);
  const type = detectReportType(sheetName, rows, fileName);
  const parsed = type === "segmentPerformance"
    ? parseSegmentPerformance(rows)
    : type === "performance" || type === "customerMovers"
      ? parsePerformance(rows)
      : { groups: parseOpportunityReport(rows, type), metrics: null };
  if (type !== "segmentPerformance" && !parsed.groups.length) {
    throw new Error(`No account rows were found in ${REPORT_TYPES[type].label}.`);
  }
  return { type, ...parsed };
}

function parseDetails(matrix) {
  const details = {};
  for (const row of matrix || []) {
    if (row[0] && row[2] !== undefined && row[2] !== "") {
      details[normalizeText(row[0])] = String(row[2]);
    }
  }
  return details;
}

export async function parseWorkbookFile(file) {
  if (!globalThis.XLSX) throw new Error("The offline Excel parser is not available.");
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false, raw: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeText(name) !== "details") || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true });
  const detailsSheetName = workbook.SheetNames.find((name) => normalizeText(name) === "details");
  const detailsMatrix = detailsSheetName
    ? XLSX.utils.sheet_to_json(workbook.Sheets[detailsSheetName], { header: 1, defval: "", raw: true })
    : [];
  return {
    ...parseReportMatrix(matrix, sheetName, file.name),
    fileName: file.name,
    fileSize: file.size,
    sheetName,
    details: parseDetails(detailsMatrix),
    parsedAt: new Date().toISOString()
  };
}

export function stageParsedReport(parsed, field, report) {
  if (parsed.type === "segmentPerformance") {
    const itemCount = parsed.segments.reduce((sum, segment) => sum + 1 + segment.items.length, 0);
    return {
      type: parsed.type,
      report: {
        type: parsed.type,
        label: REPORT_TYPES[parsed.type].label,
        fileName: parsed.fileName,
        sheetName: parsed.sheetName,
        details: parsed.details,
        metrics: parsed.metrics,
        importedAt: parsed.parsedAt,
        accountCount: 0,
        matchedCount: 0,
        reviewCount: 0,
        itemCount,
        accounts: {},
        segments: parsed.segments
      },
      reviews: []
    };
  }
  const accounts = {};
  const reviews = [];
  for (const group of parsed.groups) {
    const match = matchAccount(group.sourceName, field.accounts, report.links);
    if (match.status === "matched") {
      accounts[match.accountId] = {
        ...group,
        accountId: match.accountId,
        matchMethod: match.method
      };
    } else {
      const id = `review_${parsed.type}_${hashText(group.sourceName)}`;
      reviews.push({
        id,
        reportType: parsed.type,
        sourceName: group.sourceName,
        group,
        reason: match.reason,
        suggestions: match.suggestions,
        status: "pending",
        importedAt: parsed.parsedAt
      });
    }
  }

  return {
    type: parsed.type,
    report: {
      type: parsed.type,
      label: REPORT_TYPES[parsed.type].label,
      fileName: parsed.fileName,
      sheetName: parsed.sheetName,
      details: parsed.details,
      metrics: parsed.metrics,
      importedAt: parsed.parsedAt,
      accountCount: parsed.groups.length,
      matchedCount: Object.keys(accounts).length,
      reviewCount: reviews.length,
      itemCount: parsed.groups.reduce((sum, group) => sum + group.items.length, 0),
      accounts
    },
    reviews
  };
}

export function relinkReviewItem(review, accountId) {
  return {
    ...review.group,
    accountId,
    matchMethod: "reviewed link"
  };
}

export function displayNameFromSource(sourceName) {
  return String(sourceName || "")
    .replace(/\s-\sGI\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function aggregateRoutePerformance({
  field,
  report,
  accountIds = [],
  accountType = "all",
  period = "ytd"
}) {
  const performance = report.current?.performance;
  const metrics = performanceMetrics(performance, period);
  const previousKey = `${metrics.period}Previous`;
  const currentKey = `${metrics.period}Current`;
  const deltaKey = `${metrics.period}Delta`;
  const eligibleIds = accountIds.filter((accountId) => {
    const account = field.accounts[accountId];
    const reportType = performance?.accounts?.[accountId]?.accountType;
    const fieldType = account?.type;
    const effectiveType = ["DSD", "On-Premise"].includes(fieldType)
      ? fieldType
      : reportType || fieldType;
    return account && (accountType === "all" || effectiveType === accountType);
  });
  const matchedIds = eligibleIds.filter((accountId) => performance?.accounts?.[accountId]);
  const segments = new Map();

  for (const accountId of matchedIds) {
    for (const item of performance.accounts[accountId].items || []) {
      const key = normalizeText(item.segment || item.name);
      const current = segments.get(key) || {
        id: key,
        label: item.segment || item.name,
        previous: 0,
        current: 0,
        fallbackDeltas: []
      };
      current.previous += Number(item[previousKey]) || 0;
      current.current += Number(item[currentKey]) || 0;
      if (Number.isFinite(Number(item[deltaKey]))) {
        current.fallbackDeltas.push(Number(item[deltaKey]));
      }
      segments.set(key, current);
    }
  }

  return {
    accountCount: eligibleIds.length,
    matchedCount: matchedIds.length,
    metrics,
    segments: [...segments.values()].map((segment) => {
      const fallback = segment.fallbackDeltas.length
        ? segment.fallbackDeltas.reduce((sum, value) => sum + value, 0) / segment.fallbackDeltas.length
        : 0;
      const delta = segment.previous
        ? (segment.current - segment.previous) / segment.previous
        : fallback;
      return {
        id: segment.id,
        label: segment.label,
        previous: segment.previous,
        current: segment.current,
        delta,
        ytdPrevious: segment.previous,
        ytdCurrent: segment.current,
        ytdDelta: delta
      };
    })
  };
}
