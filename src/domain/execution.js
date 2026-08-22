import { REPORT_TYPES } from "../config.js?v=1.1.0";
import { canonicalSkuKey, normalizeText } from "./identity.js?v=1.1.0";
import { matchAccount } from "./reports.js?v=1.1.0";

export const PFP_PLAN = Object.freeze({
  id: "pfp-v1-2026-03",
  effectiveDate: "2026-03-01",
  totalPotential: 1500,
  executionPotential: 600,
  volumeBuckets: Object.freeze([
    { id: "premium", label: "Premium", measure: "Case equivalents", weight: 0.4, potential: 360 },
    { id: "hard-beverage", label: "Hard Beverage", measure: "Case equivalents", weight: 0.3, potential: 270 },
    { id: "gross-profit", label: "Gross Profit", measure: "Gross profit dollars", weight: 0.1, potential: 90 },
    { id: "mainstream", label: "Mainstream", measure: "Case equivalents", weight: 0.1, potential: 90 },
    { id: "non-alcohol", label: "Non-Alcohol", measure: "Gross profit dollars", weight: 0.075, potential: 67.5 },
    { id: "high-end", label: "High End", measure: "Case equivalents", weight: 0.025, potential: 22.5 }
  ])
});

function hashText(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function numeric(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? "").replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function objectRows(text) {
  const rows = csvRows(text);
  if (rows.length < 2) throw new Error("The CSV does not contain data rows.");
  const headers = rows[0].map((value) => normalizeText(value).replace(/\s+/g, "_"));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function normalizePerfectLaunchItem(row) {
  const name = requiredText(row.product, "Perfect Launch product");
  const skuKey = canonicalSkuKey({ name });
  return {
    id: skuKey,
    key: skuKey,
    skuKey,
    itemNumber: "",
    name,
    productStatus: String(row.product_status || ""),
    objective: String(row.objective || ""),
    priority: String(row.priority || ""),
    launchDate: dateOnly(row.launch_date),
    daysSinceLaunch: numeric(row.days_since),
    status: String(row.status || ""),
    units30: numeric(row.units_30),
    goal30: numeric(row.goal_30),
    units75: numeric(row.units_75),
    goal75: numeric(row.goal_75),
    targetActual: numeric(row.target_actual),
    targetPods: numeric(row.target_pods),
    pods75: numeric(row.pods_75),
    voids: numeric(row.voids),
    averageWeeklyGp: numeric(row.avg_wk_gp),
    onHand: numeric(row.on_hand),
    inventoryDollars: numeric(row.inventory_dollars)
  };
}

function assignmentId(item, period) {
  if (item.sourceId) return `elite:${String(item.sourceId).trim()}`;
  return `elite:${hashText([
    period,
    item.category,
    item.title,
    item.sourceName,
    item.dueDate
  ].join("|"))}`;
}

function normalizeEliteSnapshot(source) {
  const period = requiredText(source.period, "Elite period");
  const directAssignments = Array.isArray(source.assignments) ? source.assignments : [];
  const groupedAssignments = (Array.isArray(source.groups) ? source.groups : []).flatMap((group) => (
    (Array.isArray(group.accounts) ? group.accounts : []).map((account) => {
      const accountFields = typeof account === "string" ? { sourceName: account } : account;
      const sourceName = accountFields.sourceName || accountFields.account;
      return {
        ...group,
        ...accountFields,
        accounts: undefined,
        sourceName,
        sourceId: accountFields.sourceId || `${group.id || hashText(group.title || group.task)}:${normalizeText(sourceName)}`
      };
    })
  ));
  const assignments = [...directAssignments, ...groupedAssignments];
  if (!assignments.length) throw new Error("Elite snapshot has no assignments.");
  return {
    period,
    sourceDate: dateOnly(source.sourceDate) || new Date().toISOString().slice(0, 10),
    assignments: assignments.map((item) => {
      const sourceName = requiredText(item.sourceName || item.account, "Elite account");
      const title = requiredText(item.title || item.task, "Elite task");
      const normalized = {
        sourceId: String(item.sourceId || ""),
        sourceName,
        title,
        details: String(item.details || ""),
        category: String(item.category || item.type || "General"),
        campaign: String(item.campaign || ""),
        sourceStatus: String(item.sourceStatus || item.status || "To Do"),
        dueDate: dateOnly(item.dueDate || item.due),
        dueLabel: String(item.dueLabel || ((!dateOnly(item.dueDate || item.due) && item.due) ? item.due : "")),
        period
      };
      return { ...normalized, id: assignmentId(normalized, period) };
    })
  };
}

function normalizePreorderSnapshot(source) {
  const period = requiredText(source.period, "Preorder period");
  const items = Array.isArray(source.items) ? source.items : [];
  if (!items.length) throw new Error("Preorder snapshot has no products.");
  return {
    period,
    sourceDate: dateOnly(source.sourceDate) || new Date().toISOString().slice(0, 10),
    items: items.map((item) => {
      const name = requiredText(item.name, "Preorder product");
      const itemNumber = String(item.itemNumber || item.id || "").trim();
      const id = itemNumber ? `item:${itemNumber}` : canonicalSkuKey({ name });
      return {
        id,
        itemNumber,
        name,
        objective: String(item.objective || ""),
        priority: String(item.priority || ""),
        sourceStatus: String(item.sourceStatus || item.status || "Pre-order"),
        goal: numeric(item.goal),
        actual: numeric(item.actual),
        deadline: dateOnly(item.deadline),
        launchDate: dateOnly(item.launchDate),
        currentInventory: numeric(item.currentInventory)
      };
    })
  };
}

function normalizePfpScorecard(source) {
  const period = requiredText(source.period, "PFP period");
  const suppliedBuckets = Array.isArray(source.buckets) ? source.buckets : [];
  const byId = new Map(suppliedBuckets.map((bucket) => [normalizeText(bucket.id || bucket.label), bucket]));
  const buckets = PFP_PLAN.volumeBuckets.map((definition) => {
    const supplied = byId.get(definition.id) || byId.get(normalizeText(definition.label)) || {};
    return {
      ...definition,
      goal: numeric(supplied.goal),
      actual: numeric(supplied.actual)
    };
  });
  const execution = source.execution || {};
  return {
    period,
    sourceDate: dateOnly(source.sourceDate) || new Date().toISOString().slice(0, 10),
    sourceStatus: String(source.sourceStatus || "Open - projection, not pay"),
    planId: PFP_PLAN.id,
    buckets,
    execution: {
      completed: numeric(execution.completed),
      assigned: numeric(execution.assigned),
      distributionCompleted: numeric(execution.distributionCompleted),
      distributionAssigned: numeric(execution.distributionAssigned),
      displayCompleted: numeric(execution.displayCompleted),
      displayAssigned: numeric(execution.displayAssigned)
    },
    campaigns: Array.isArray(source.campaigns) ? source.campaigns.map((campaign) => ({
      name: requiredText(campaign.name, "PFP campaign"),
      type: String(campaign.type || ""),
      completed: numeric(campaign.completed),
      assigned: numeric(campaign.assigned),
      target: numeric(campaign.target)
    })) : []
  };
}

export function volumePayoutFactor(attainment) {
  const value = Math.max(0, numeric(attainment));
  if (value < 0.7) return 0;
  const factor = value <= 1
    ? 0.25 + ((value - 0.7) * 2.5)
    : Math.min(1.3, 1 + ((value - 1) * 1.5));
  return Math.round(factor * 1e10) / 1e10;
}

export function calculatePfp(scorecard) {
  if (!scorecard) return null;
  const buckets = (scorecard.buckets || []).map((bucket) => {
    const goal = numeric(bucket.goal);
    const actual = numeric(bucket.actual);
    const attainment = goal > 0 ? actual / goal : 0;
    const payoutFactor = volumePayoutFactor(attainment);
    const estimatedPay = numeric(bucket.potential) * payoutFactor;
    return { ...bucket, goal, actual, attainment, payoutFactor, estimatedPay };
  });
  const volumePay = buckets.reduce((sum, bucket) => sum + bucket.estimatedPay, 0);
  const assigned = numeric(scorecard.execution?.assigned);
  const completed = Math.min(assigned, numeric(scorecard.execution?.completed));
  const executionAttainment = assigned > 0 ? completed / assigned : 0;
  const executionPay = PFP_PLAN.executionPotential * Math.min(1, executionAttainment);
  return {
    ...scorecard,
    buckets,
    volumePay,
    executionPay,
    executionAttainment,
    estimatedPay: volumePay + executionPay,
    totalPotential: PFP_PLAN.totalPotential,
    isEstimate: true
  };
}

export function projectPfpScorecard(field, report) {
  const source = report.current?.pfpScorecard?.scorecard;
  if (!source) return null;

  const sourceScorecard = calculatePfp(source);
  const campaignsByKey = new Map((sourceScorecard.campaigns || []).map((campaign) => [
    normalizeText(campaign.name),
    campaign
  ]));
  const localCompletions = new Map();

  for (const account of Object.values(report.current?.eliteAssignments?.accounts || {})) {
    for (const item of account.items || []) {
      const campaignKey = normalizeText(item.campaign);
      const sourceStatus = normalizeText(item.sourceStatus);
      const isSourceClosed = ["complete", "completed", "done", "validated", "rejected"].includes(sourceStatus);
      if (!campaignsByKey.has(campaignKey) || isSourceClosed || !field.eliteStates[item.id]?.completedAt) continue;
      if (!localCompletions.has(campaignKey)) localCompletions.set(campaignKey, new Set());
      localCompletions.get(campaignKey).add(item.id);
    }
  }

  let localExecutionCompleted = 0;
  const campaigns = (sourceScorecard.campaigns || []).map((campaign) => {
    const campaignKey = normalizeText(campaign.name);
    const localCount = localCompletions.get(campaignKey)?.size || 0;
    const available = Math.max(0, numeric(campaign.assigned) - numeric(campaign.completed));
    const localProjected = Math.min(localCount, available);
    localExecutionCompleted += localProjected;
    return {
      ...campaign,
      sourceCompleted: numeric(campaign.completed),
      localProjected,
      completed: numeric(campaign.completed) + localProjected
    };
  });
  const sourceExecutionCompleted = numeric(sourceScorecard.execution.completed);
  const projectedExecutionCompleted = Math.min(
    numeric(sourceScorecard.execution.assigned),
    sourceExecutionCompleted + localExecutionCompleted
  );
  const projected = calculatePfp({
    ...sourceScorecard,
    campaigns,
    execution: {
      ...sourceScorecard.execution,
      completed: projectedExecutionCompleted
    }
  });

  return {
    ...projected,
    sourceExecutionCompleted,
    localExecutionCompleted,
    sourceEstimatedPay: sourceScorecard.estimatedPay,
    localEstimatedLift: Math.max(0, projected.estimatedPay - sourceScorecard.estimatedPay),
    remainingPotential: Math.max(0, projected.totalPotential - projected.estimatedPay)
  };
}

export async function parseDataFile(file) {
  const name = String(file.name || "");
  const extension = name.split(".").pop()?.toLowerCase();
  const importedAt = new Date().toISOString();
  if (extension === "csv") {
    const items = objectRows(await file.text()).map(normalizePerfectLaunchItem);
    return {
      type: "perfectLaunchCatalog",
      fileName: name,
      fileSize: file.size,
      importedAt,
      sourceDate: dateOnly(name.match(/\d{4}-\d{2}-\d{2}/)?.[0]),
      items
    };
  }
  if (extension !== "json") throw new Error("Use XLSX for work reports, CSV for Perfect Launch, or a structured JSON snapshot.");
  const source = JSON.parse(await file.text());
  const type = String(source.type || "");
  let normalized;
  if (type === "eliteAssignments") normalized = normalizeEliteSnapshot(source);
  else if (type === "preorders") normalized = normalizePreorderSnapshot(source);
  else if (type === "pfpScorecard") normalized = normalizePfpScorecard(source);
  else throw new Error("JSON type must be eliteAssignments, preorders, or pfpScorecard.");
  return {
    type,
    fileName: name,
    fileSize: file.size,
    importedAt,
    ...normalized
  };
}

function reviewId(type, sourceName) {
  return `review_${type}_${hashText(sourceName)}`;
}

export function stageDataReport(parsed, field, report) {
  if (parsed.type === "eliteAssignments") {
    const grouped = new Map();
    for (const assignment of parsed.assignments) {
      if (!grouped.has(assignment.sourceName)) grouped.set(assignment.sourceName, []);
      grouped.get(assignment.sourceName).push(assignment);
    }
    const accounts = {};
    const reviews = [];
    for (const [sourceName, items] of grouped) {
      const match = matchAccount(sourceName, field.accounts, report.links);
      const group = { sourceName, items };
      if (match.status === "matched") {
        const existing = accounts[match.accountId];
        accounts[match.accountId] = existing
          ? {
              ...existing,
              sourceName: `${existing.sourceName} / ${sourceName}`,
              items: [...existing.items, ...items]
            }
          : {
              ...group,
              accountId: match.accountId,
              matchMethod: match.method
            };
      } else {
        reviews.push({
          id: reviewId(parsed.type, sourceName),
          reportType: parsed.type,
          sourceName,
          group,
          reason: match.reason,
          suggestions: match.suggestions,
          status: "pending",
          importedAt: parsed.importedAt
        });
      }
    }
    return {
      type: parsed.type,
      report: {
        type: parsed.type,
        label: REPORT_TYPES[parsed.type].label,
        fileName: parsed.fileName,
        importedAt: parsed.importedAt,
        sourceDate: parsed.sourceDate,
        period: parsed.period,
        accountCount: grouped.size,
        matchedCount: Object.keys(accounts).length,
        reviewCount: reviews.length,
        itemCount: parsed.assignments.length,
        accounts
      },
      reviews
    };
  }

  const itemCount = parsed.items?.length || parsed.campaigns?.length || parsed.buckets?.length || 0;
  const reportBody = parsed.type === "pfpScorecard"
    ? { scorecard: calculatePfp(parsed) }
    : { items: parsed.items || [] };
  return {
    type: parsed.type,
    report: {
      type: parsed.type,
      label: REPORT_TYPES[parsed.type].label,
      fileName: parsed.fileName,
      importedAt: parsed.importedAt,
      sourceDate: parsed.sourceDate,
      period: parsed.period || null,
      accountCount: 0,
      matchedCount: 0,
      reviewCount: 0,
      itemCount,
      accounts: {},
      ...reportBody
    },
    reviews: []
  };
}

export function eliteAssignmentsForAccount(report, accountId) {
  return report.current?.eliteAssignments?.accounts?.[accountId]?.items || [];
}

export function preorderStateId(accountId, itemId) {
  return `${accountId}:${itemId}`;
}

export function perfectLaunchContext(report, item) {
  const catalog = report.current?.perfectLaunchCatalog?.items || [];
  const skuKey = item.skuKey || item.key || canonicalSkuKey(item);
  return catalog.find((entry) => entry.skuKey === skuKey) || null;
}
