import { DAY_DEFS } from "../../config.js?v=1.1.0";
import { dateKey, dayDefinition, formatLongDate, weekKey } from "../../domain/dates.js?v=1.1.0";
import {
  computeAccountHealth,
  computeRouteHealth,
  currentWeekHealth,
  visitKey
} from "../../domain/health.js?v=1.1.0";
import { projectPfpScorecard } from "../../domain/execution.js?v=1.1.0";
import { aggregateRoutePerformance } from "../../domain/reports.js?v=1.1.0";
import {
  appScreen,
  badge,
  displayAccountName,
  emptyState,
  escapeHtml,
  gradeChip,
  icon,
  panel,
  performancePeriodControl,
  progressBar,
  screenHeader,
  sectionHeading
} from "../components.js?v=1.1.0";

function nextAccount(field, dayId, today) {
  const accountIds = field.routes[dayId] || [];
  return accountIds
    .map((accountId, index) => ({ account: field.accounts[accountId], accountId, index }))
    .find((item) => item.account && !field.visits[visitKey(item.accountId, today)]);
}

function routeProgress(field, dayId, today) {
  const accountIds = (field.routes[dayId] || []).filter((id) => field.accounts[id]);
  const visited = accountIds.filter((id) => field.visits[visitKey(id, today)]).length;
  return {
    total: accountIds.length,
    visited,
    percent: accountIds.length ? Math.round((visited / accountIds.length) * 100) : 0
  };
}

function urgentItems(field, report, today) {
  const tasks = Object.values(field.tasks)
    .filter((task) => !task.doneAt && task.dueDate && task.dueDate <= today)
    .map((task) => ({ ...task, kind: "Task" }));
  const followUps = Object.values(field.followUps)
    .filter((item) => !item.doneAt && item.dueDate && item.dueDate <= today)
    .map((item) => ({ ...item, kind: "Follow-up" }));
  const elite = Object.entries(report.current?.eliteAssignments?.accounts || {}).flatMap(([accountId, group]) => (
    (group.items || [])
      .filter((item) => {
        const rejected = String(item.sourceStatus || "").toLowerCase() === "rejected";
        const overdue = String(item.dueLabel || "").toLowerCase() === "overdue";
        return !rejected && !field.eliteStates[item.id]?.completedAt && (overdue || (item.dueDate && item.dueDate <= today));
      })
      .map((item) => ({ ...item, accountId, kind: "Elite" }))
  ));
  return [...followUps, ...tasks, ...elite].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

const PERFORMANCE_FILTERS = [
  { id: "all", label: "All" },
  { id: "Independent", label: "Indys" },
  { id: "Chain", label: "Chains" },
  { id: "DSD", label: "DSD" },
  { id: "On-Premise", label: "On-Prem" }
];

const SEGMENT_ORDER = [
  "premium",
  "mainstream",
  "hard beverage",
  "non alcohol",
  "high end"
];

function formatVolume(value) {
  const number = Number(value) || 0;
  return number.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDelta(value) {
  const percentage = Math.round((Number(value) || 0) * 100);
  return `${percentage > 0 ? "+" : ""}${percentage}%`;
}

function money(value) {
  const number = Number(value) || 0;
  const fractionDigits = Number.isInteger(number) ? 0 : 2;
  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function pfpContent(field, report) {
  const scorecard = projectPfpScorecard(field, report);
  if (!scorecard) {
    return `<div class="panel--pad pfp-empty">
      <p class="t-body">Import the current monthly PFP snapshot to see volume gates, validated execution, and an estimated payout.</p>
      <button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-up", 16)}Import PFP</button>
    </div>`;
  }
  const volumePercent = Math.min(100, (scorecard.volumePay / 900) * 100);
  const executionPercent = Math.min(100, scorecard.executionAttainment * 100);
  return `<button class="pfp-glance" type="button" data-action="navigate" data-route="activity">
    <span class="pfp-glance__head"><span><small>${escapeHtml(scorecard.period)}</small><b>${money(scorecard.estimatedPay)} projected</b><small>${money(scorecard.remainingPotential)} potential remaining</small></span>${badge("Not committed pay", "open")}</span>
    <span class="pfp-glance__metric"><span><b>Volume</b><small>${money(scorecard.volumePay)} projected</small></span><strong>${Math.round(volumePercent)}%</strong></span>
    ${progressBar(volumePercent)}
    <span class="pfp-glance__metric"><span><b>Execution</b><small>${scorecard.sourceExecutionCompleted} source + ${scorecard.localExecutionCompleted} local · ${scorecard.execution.assigned} assigned</small></span><strong>${Math.round(executionPercent)}%</strong></span>
    ${progressBar(executionPercent, "pine")}
  </button>`;
}

function routePerformanceContent(field, report, dayId, selectedFilter, selectedPeriod) {
  const routeAccountIds = field.routes[dayId] || [];
  const performance = aggregateRoutePerformance({
    field,
    report,
    accountIds: routeAccountIds,
    accountType: selectedFilter,
    period: selectedPeriod
  });
  const segments = performance.segments.sort((left, right) => {
    const leftIndex = SEGMENT_ORDER.indexOf(left.id);
    const rightIndex = SEGMENT_ORDER.indexOf(right.id);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });

  return `<div class="panel--pad route-performance">
    ${performancePeriodControl(performance.metrics)}
    <div class="performance-filters" role="group" aria-label="Filter route performance by account type">
      ${PERFORMANCE_FILTERS.map((filter) => `<button
        class="performance-filter ${selectedFilter === filter.id ? "is-active" : ""}"
        type="button"
        data-action="select-performance-filter"
        data-value="${escapeHtml(filter.id)}"
        aria-pressed="${selectedFilter === filter.id}"
      >${escapeHtml(filter.label)}</button>`).join("")}
    </div>
    ${segments.length ? `
      <p class="route-performance__coverage">${performance.matchedCount} of ${performance.accountCount} route account${performance.accountCount === 1 ? "" : "s"} matched · ${escapeHtml(performance.metrics.valueLabel)} ${escapeHtml(performance.metrics.comparisonLabel)}</p>
      <div class="route-performance__list">
        ${segments.map((segment) => `<div class="route-performance__row">
          <span>
            <b>${escapeHtml(segment.label)}</b>
            <small>${formatVolume(segment.current)} ${escapeHtml(performance.metrics.valueLabel)}</small>
          </span>
          <strong class="delta ${segment.delta >= 0 ? "delta--up" : "delta--down"}">
            <span>${formatDelta(segment.delta)}</span>
            <small>${escapeHtml(performance.metrics.comparisonLabel)}</small>
          </strong>
        </div>`).join("")}
      </div>
    ` : `<div class="route-performance__empty">
      <p>${performance.accountCount
        ? "Import and match Account Performance to see this route by segment."
        : "No accounts in this route match the selected type."}</p>
      ${performance.accountCount ? `<button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-spreadsheet", 16)}Import report</button>` : ""}
    </div>`}
  </div>`;
}

export function renderHome(state, context = {}) {
  const { field, report, ui } = state;
  const today = dateKey();
  const dayId = ui.routeDay;
  const day = dayDefinition(dayId);
  const progress = routeProgress(field, dayId, today);
  const next = nextAccount(field, dayId, today);
  const health = computeRouteHealth({ dayId, week: weekKey(), field, report, asOf: today });
  const weekHealth = currentWeekHealth(field, report, today);
  const urgent = urgentItems(field, report, today);
  const accountCount = Object.keys(field.accounts).length;
  const performanceFilter = context.routePerformanceFilter || "all";
  const performancePeriod = context.performancePeriod || "ytd";

  const header = screenHeader({
    eyebrow: `${formatLongDate(new Date())}`,
    title: `Good morning, ${field.settings.firstName}`,
    subtitle: accountCount
      ? `${progress.total - progress.visited} stops left on ${day.label}.`
      : "A fresh route is ready when you are."
  });

  let body;
  if (!accountCount) {
    body = `<div class="home-content">
      ${panel(emptyState({
        iconName: "map",
        title: "Your route starts empty",
        message: "Add your first account, then place it on one or more weekday routes.",
        action: "add-account",
        actionLabel: "Add first account"
      }))}
      ${sectionHeading("Reports")}
      ${panel(`<div class="panel--pad">
        <h2 class="h-card">Bring in work reports when you are ready</h2>
        <p class="t-body">Excel imports stay separate from notes, visits, route order, and every other field record.</p>
        <button class="btn btn--secondary btn--full" type="button" data-action="navigate" data-route="import">${icon("file-spreadsheet")}Import reports</button>
      </div>`)}
    </div>`;
  } else {
    const nextHealth = next
      ? computeAccountHealth({ accountId: next.accountId, field, report, asOf: today })
      : null;
    body = `<div class="home-content">
      ${panel(`<div class="panel--pad">
        <div class="next-stop__head">
          <span class="t-cap">${next ? "Next stop" : progress.total ? "Route complete" : "No stops scheduled"}</span>
          ${gradeChip(next ? nextHealth : health, 34)}
        </div>
        ${next ? `
          <h2 class="next-stop__name">${escapeHtml(displayAccountName(next.account))}</h2>
          <p class="t-sub">${escapeHtml(next.account.town || "Town not set")}${next.account.storeNumber ? ` · Store #${escapeHtml(next.account.storeNumber)}` : ""}</p>
          <div class="next-stop__badges">
            ${badge(`${next.index + 1} of ${progress.total}`, "amber")}
            ${nextHealth?.reasons?.[0] ? badge(nextHealth.reasons[0], nextHealth.grade === "A" || nextHealth.grade === "B" ? "done" : "due") : badge("No health signals", "open")}
          </div>
          <button class="btn btn--primary btn--full" type="button" data-action="start-route" data-day="${dayId}">${icon("navigation")}Start route</button>
        ` : progress.total ? `
          <h2 class="next-stop__name">Nice work. ${day.label} is wrapped.</h2>
          <p class="t-body">All ${progress.total} scheduled accounts have a visit on the books.</p>
          <button class="btn btn--secondary btn--full" type="button" data-action="navigate" data-route="activity">${icon("sparkles")}Review the day</button>
        ` : `
          <h2 class="next-stop__name">Nothing scheduled for ${day.label}</h2>
          <p class="t-body">Use the route editor to add stops or choose another weekday.</p>
          <button class="btn btn--primary btn--full" type="button" data-action="navigate" data-route="route-editor">Edit route</button>
        `}
      </div>`)}

      ${sectionHeading("Today's rhythm")}
      ${panel(`<div class="panel--pad">
        <div class="progress-head">
          <div>
            <h2 class="h-card">${day.label} progress</h2>
            <span class="t-sub">${progress.visited} of ${progress.total} visited</span>
          </div>
          <strong class="t-num">${progress.percent}%</strong>
        </div>
        <div style="margin-top:12px">${progressBar(progress.percent, progress.percent === 100 ? "pine" : "")}</div>
      </div>`)}

      ${sectionHeading("Route health")}
      ${panel(`<div class="panel--pad">
        <div class="week-strip">
          ${DAY_DEFS.map((item) => {
            const itemHealth = weekHealth[item.id];
            return `<button class="week-strip__day ${itemHealth.grade ? "" : "is-no-data"}" type="button" data-action="select-day" data-value="${item.id}">
              ${gradeChip(itemHealth, 44)}
              <span class="week-strip__label">${item.label}</span>
            </button>`;
          }).join("")}
        </div>
        <p class="t-sub" style="margin:14px 0 0">Grades describe route readiness. The check mark records whether every scheduled visit happened.</p>
      </div>`)}

      ${sectionHeading("PFP pace")}
      ${panel(pfpContent(field, report))}

      ${sectionHeading("Route performance")}
      ${panel(routePerformanceContent(field, report, dayId, performanceFilter, performancePeriod))}

      ${urgent.length ? `
        ${sectionHeading("Needs attention", `<button class="btn btn--small btn--quiet" data-action="navigate" data-route="followups">View all</button>`)}
        ${urgent.slice(0, 3).map((item) => {
          const account = field.accounts[item.accountId];
          return `<button class="urgent-signal" type="button" data-action="open-account" data-account-id="${escapeHtml(item.accountId)}">
            ${icon(item.kind === "Follow-up" ? "calendar-clock" : item.kind === "Elite" ? "badge-check" : "circle-alert")}
            <span class="urgent-signal__body">
              <b>${escapeHtml(item.title)}</b>
              <span>${escapeHtml(account ? displayAccountName(account) : "Unknown account")} · ${escapeHtml(item.kind)}</span>
            </span>
            ${icon("chevron-right", 18)}
          </button>`;
        }).join("")}
      ` : ""}
    </div>`;
  }

  return appScreen({
    route: "home",
    field,
    header,
    content: body,
    isOnline: context.isOnline
  });
}
