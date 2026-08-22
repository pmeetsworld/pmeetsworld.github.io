import {
  COMPLIANCE_ITEMS,
  DAY_DEFS,
  isOpenOpportunityState
} from "../config.js?v=1.1.0";
import {
  dateForRouteDay,
  dateKey,
  daysBetween,
  isOverdue,
  weekKey
} from "./dates.js?v=1.1.0";
import { opportunityStateId } from "./identity.js?v=1.1.0";

export const GRADE_STYLES = Object.freeze({
  A: { fill: "#3d7a5c", color: "#ffffff", label: "Strong" },
  B: { fill: "#6b7c8c", color: "#ffffff", label: "Steady" },
  C: { fill: "#e8801f", color: "#ffffff", label: "Watch" },
  D: { fill: "#c25438", color: "#ffffff", label: "Needs attention" },
  F: { fill: "#20241f", color: "#ffffff", label: "Critical" },
  none: { fill: "#e9e7e1", color: "#747b73", label: "No data" }
});

export function gradeFromScore(score, hasData = true) {
  if (!hasData || !Number.isFinite(score)) return null;
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function gradeStyle(grade) {
  return GRADE_STYLES[grade || "none"];
}

export function reportOpportunitiesForAccount(report, accountId) {
  const opportunities = new Map();
  for (const type of ["chainVoid", "scaleUp", "perfectLaunch"]) {
    const current = report.current?.[type];
    const account = current?.accounts?.[accountId];
    if (!account) continue;
    for (const item of account.items || []) {
      const sku = item.skuKey || item.key;
      const existing = opportunities.get(sku);
      if (existing) {
        existing.reportTypes.push(type);
        existing.priority ||= item.priority;
        existing.category ||= item.category;
        existing.itemNumber ||= item.itemNumber;
      } else {
        opportunities.set(sku, {
          ...item,
          reportType: type,
          reportTypes: [type]
        });
      }
    }
  }
  return [...opportunities.values()];
}

const PERFORMANCE_SEGMENT_WEIGHTS = Object.freeze({
  premium: 0.225,
  mainstream: 0.225,
  "hard beverage": 0.225,
  "non alcohol": 0.225,
  "high end": 0.1
});

function segmentKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function segmentScore(item) {
  const delta = Number(item?.ytdDelta);
  if (!Number.isFinite(delta)) return null;
  return Math.max(0, Math.min(100, (1 + delta) * 100));
}

export function computeSegmentPerformance(report, accountId) {
  const account = report.current?.performance?.accounts?.[accountId];
  if (!account) {
    return {
      hasData: false,
      matched: false,
      score: null,
      belowCount: 0,
      observedSegments: 0,
      expectedSegments: Object.keys(PERFORMANCE_SEGMENT_WEIGHTS).length,
      missingSegments: []
    };
  }

  const items = new Map(
    (account.items || []).map((item) => [segmentKey(item.segment || item.name), item])
  );
  const missingSegments = Object.keys(PERFORMANCE_SEGMENT_WEIGHTS)
    .filter((segment) => !items.has(segment));
  const scoredItems = Object.entries(PERFORMANCE_SEGMENT_WEIGHTS).map(([segment, weight]) => {
    const item = items.get(segment);
    return {
      segment,
      weight,
      score: segmentScore(item),
      delta: Number(item?.ytdDelta)
    };
  });
  const hasEveryScore = !missingSegments.length && scoredItems.every((item) => item.score !== null);

  if (!hasEveryScore) {
    return {
      hasData: false,
      matched: true,
      score: null,
      belowCount: scoredItems.filter((item) => Number.isFinite(item.delta) && item.delta < 0).length,
      observedSegments: items.size,
      expectedSegments: Object.keys(PERFORMANCE_SEGMENT_WEIGHTS).length,
      missingSegments
    };
  }

  return {
    hasData: true,
    matched: true,
    score: Math.round(scoredItems.reduce((sum, item) => sum + item.score * item.weight, 0)),
    belowCount: scoredItems.filter((item) => item.delta < 0).length,
    observedSegments: scoredItems.length,
    expectedSegments: scoredItems.length,
    missingSegments: [],
    segments: scoredItems
  };
}

function accountValues(collection, accountId) {
  return Object.values(collection || {}).filter((item) => item.accountId === accountId);
}

export function computeAccountHealth({
  accountId,
  field,
  report,
  asOf = dateKey()
}) {
  const account = field.accounts[accountId];
  if (!account) {
    return { grade: null, score: null, hasData: false, reasons: [], metrics: {} };
  }

  const tasks = accountValues(field.tasks, accountId);
  const followUps = accountValues(field.followUps, accountId);
  const visits = accountValues(field.visits, accountId);
  const compliance = field.compliance[accountId] || {};
  const opportunities = reportOpportunitiesForAccount(report, accountId);
  const segmentPerformance = computeSegmentPerformance(report, accountId);
  const openOpportunities = opportunities.filter((item) => {
    const stateId = opportunityStateId(accountId, item);
    const state = field.opportunityStates[stateId] || "Open";
    return isOpenOpportunityState(state);
  });

  const overdueTasks = tasks.filter((task) => !task.doneAt && isOverdue(task.dueDate, asOf));
  const overdueFollowUps = followUps.filter((item) => !item.doneAt && isOverdue(item.dueDate, asOf));
  const lastVisit = visits
    .map((visit) => visit.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  const staleCompliance = COMPLIANCE_ITEMS.filter((item) => {
    const record = compliance[item.id];
    const completed = record?.completedOn || (record?.completedAt ? dateKey(record.completedAt) : "");
    return !completed || daysBetween(completed, asOf) > 30;
  });

  const operationalHasData = Boolean(
    tasks.length ||
    followUps.length ||
    visits.length ||
    opportunities.length ||
    Object.keys(compliance).length
  );
  const hasData = operationalHasData || segmentPerformance.hasData;

  if (!hasData) {
    const incompletePerformance = segmentPerformance.matched && segmentPerformance.missingSegments.length;
    return {
      grade: null,
      score: null,
      hasData: false,
      reasons: [incompletePerformance
        ? `Performance report needs ${segmentPerformance.missingSegments.length} more segment${segmentPerformance.missingSegments.length === 1 ? "" : "s"}`
        : "No field activity or report signals yet"],
      metrics: {
        overdueTasks: 0,
        overdueFollowUps: 0,
        openOpportunities: 0,
        staleCompliance: 0,
        daysSinceVisit: null,
        operationalScore: null,
        segmentPerformance: null,
        performanceCoverage: segmentPerformance.observedSegments
      }
    };
  }

  const daysSinceVisit = lastVisit ? Math.max(0, daysBetween(lastVisit, asOf)) : null;
  let operationalScore = null;
  if (operationalHasData) {
    operationalScore = 100;
    operationalScore -= Math.min(30, overdueTasks.length * 10);
    operationalScore -= Math.min(36, overdueFollowUps.length * 12);
    operationalScore -= Math.min(25, openOpportunities.length * 1.5);
    operationalScore -= Math.min(20, staleCompliance.length * 4);
    if (daysSinceVisit === null) operationalScore -= 12;
    else if (daysSinceVisit > 30) operationalScore -= 18;
    else if (daysSinceVisit > 14) operationalScore -= 10;
    else if (daysSinceVisit <= 7) operationalScore += 3;
    operationalScore = Math.max(0, Math.min(100, operationalScore));
  }

  let score = operationalScore;
  if (segmentPerformance.hasData) {
    score = operationalScore === null
      ? segmentPerformance.score
      : operationalScore * 0.75 + segmentPerformance.score * 0.25;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const reasons = [];
  if (operationalHasData) {
    if (overdueFollowUps.length) reasons.push(`${overdueFollowUps.length} overdue follow-up${overdueFollowUps.length === 1 ? "" : "s"}`);
    if (overdueTasks.length) reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`);
    if (openOpportunities.length) reasons.push(`${openOpportunities.length} open opportunit${openOpportunities.length === 1 ? "y" : "ies"}`);
    if (staleCompliance.length) reasons.push(`${staleCompliance.length} compliance check${staleCompliance.length === 1 ? "" : "s"} due`);
    if (daysSinceVisit === null) reasons.push("No visit recorded");
    else if (daysSinceVisit > 14) reasons.push(`${daysSinceVisit} days since last visit`);
  }
  if (segmentPerformance.hasData) {
    reasons.push(segmentPerformance.belowCount
      ? `${segmentPerformance.belowCount} performance segment${segmentPerformance.belowCount === 1 ? "" : "s"} below prior YTD`
      : "Segment performance is at or above prior YTD");
  } else if (segmentPerformance.matched && segmentPerformance.missingSegments.length) {
    reasons.push(`Performance report is missing ${segmentPerformance.missingSegments.length} segment${segmentPerformance.missingSegments.length === 1 ? "" : "s"}`);
  }
  if (!reasons.length) reasons.push("Current field work is in good shape");

  return {
    grade: gradeFromScore(score),
    score,
    hasData: true,
    reasons,
    metrics: {
      overdueTasks: overdueTasks.length,
      overdueFollowUps: overdueFollowUps.length,
      openOpportunities: openOpportunities.length,
      staleCompliance: staleCompliance.length,
      daysSinceVisit,
      operationalScore: operationalScore === null ? null : Math.round(operationalScore),
      segmentPerformance: segmentPerformance.score,
      performanceCoverage: segmentPerformance.observedSegments,
      performanceWeight: operationalScore === null && segmentPerformance.hasData ? 1 : segmentPerformance.hasData ? 0.25 : 0
    }
  };
}

export function visitKey(accountId, date) {
  return `${accountId}:${date}`;
}

export function computeRouteHealth({
  dayId,
  week = weekKey(),
  field,
  report,
  asOf = dateKey()
}) {
  const routeDate = dateKey(dateForRouteDay(dayId, week));
  const accountIds = field.routes[dayId] || [];
  if (!accountIds.length || routeDate > asOf) {
    return {
      dayId,
      date: routeDate,
      grade: null,
      score: null,
      hasData: false,
      visited: 0,
      total: accountIds.length,
      complete: false,
      reasons: accountIds.length ? ["Future route"] : ["No accounts scheduled"]
    };
  }

  const health = accountIds.map((accountId) => computeAccountHealth({
    accountId,
    field,
    report,
    asOf: routeDate
  }));
  const scored = health.filter((item) => item.hasData);
  const visited = accountIds.filter((accountId) => Boolean(field.visits[visitKey(accountId, routeDate)])).length;
  const routeIsPast = routeDate < asOf;
  let score = scored.length
    ? scored.reduce((sum, item) => sum + item.score, 0) / scored.length
    : null;

  if (routeIsPast) {
    const completionRate = accountIds.length ? visited / accountIds.length : 0;
    score = score === null ? completionRate * 100 : score * 0.75 + completionRate * 25;
  }

  const hasData = score !== null;
  const rounded = hasData ? Math.max(0, Math.min(100, Math.round(score))) : null;
  return {
    dayId,
    date: routeDate,
    grade: gradeFromScore(rounded, hasData),
    score: rounded,
    hasData,
    visited,
    total: accountIds.length,
    complete: accountIds.length > 0 && visited === accountIds.length,
    reasons: scored.flatMap((item) => item.reasons).slice(0, 3)
  };
}

export function currentWeekHealth(field, report, asOf = dateKey()) {
  const week = weekKey(asOf);
  return Object.fromEntries(
    DAY_DEFS.map((day) => [
      day.id,
      computeRouteHealth({ dayId: day.id, week, field, report, asOf })
    ])
  );
}

export function snapshotHealth(field, report, importedAt = new Date().toISOString()) {
  const asOf = importedAt.slice(0, 10);
  return {
    generatedAt: importedAt,
    week: weekKey(asOf),
    days: currentWeekHealth(field, report, asOf)
  };
}
