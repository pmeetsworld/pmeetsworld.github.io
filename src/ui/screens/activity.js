import { COMPLIANCE_ITEMS, normalizeOpportunityState } from "../../config.js?v=1.1.0";
import {
  dateKey,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  monthGrid,
  routeDayForDate,
  weekKey
} from "../../domain/dates.js?v=1.1.0";
import { projectPfpScorecard } from "../../domain/execution.js?v=1.1.0";
import { computeRouteHealth, gradeStyle } from "../../domain/health.js?v=1.1.0";
import { performanceMetrics } from "../../domain/reports.js?v=1.1.0";
import {
  appScreen,
  badge,
  displayAccountName,
  emptyState,
  escapeHtml,
  icon,
  panel,
  performancePeriodControl,
  progressBar,
  screenHeader,
  segmented,
  sectionHeading
} from "../components.js?v=1.1.0";

export const ROUTE_HEALTH_HISTORY_START = "2026-07";

function historicalHealth(date, field, report) {
  const key = dateKey(date);
  if (field.healthLog[key]) return field.healthLog[key];
  for (const snapshot of [...(report.snapshots || [])].reverse()) {
    const matching = Object.values(snapshot.health?.days || {}).find((day) => day.date === key);
    if (matching) return matching;
  }
  if (key !== dateKey()) return null;
  const dayId = routeDayForDate(date);
  return computeRouteHealth({
    dayId,
    week: weekKey(date),
    field,
    report,
    asOf: key
  });
}

function healthCalendar(field, report, month) {
  const cells = monthGrid(month);
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `<div class="health-calendar">
    ${labels.map((label) => `<span class="health-calendar__label">${label}</span>`).join("")}
    ${cells.map((date) => {
      if (!date) return `<span class="health-cell is-empty"></span>`;
      const key = dateKey(date);
      const health = historicalHealth(date, field, report);
      const style = gradeStyle(health?.grade);
      const isToday = key === dateKey();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const grade = isWeekend ? "" : health?.grade || "-";
      return `<button
        class="health-cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-empty is-weekend" : ""} ${health?.grade === "F" ? "is-failing" : ""}"
        style="--grade-fill:${isWeekend ? "transparent" : style.fill};--grade-color:${style.color}"
        type="button"
        data-action="open-health-day"
        data-date="${key}"
        ${isWeekend ? "disabled" : ""}
      >
        <span class="health-cell__day">${date.getDate()}</span>
        <span class="health-cell__grade">${grade}</span>
        ${health?.complete ? `<span class="health-cell__done">${icon("check", 10)}</span>` : ""}
      </button>`;
    }).join("")}
  </div>
  <div class="health-legend">
    ${["A", "B", "C", "D", "F"].map((grade) => {
      const style = gradeStyle(grade);
      return `<span><i style="width:8px;height:8px;border-radius:50%;background:${style.fill}"></i>${grade}</span>`;
    }).join("")}
    <span><i style="width:8px;height:8px;border-radius:50%;background:var(--fog)"></i>No data</span>
  </div>`;
}

function monthLabel(key) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
    .format(new Date(`${key}-01T12:00:00`));
}

export function availableHealthMonths(field, report, currentMonth = dateKey().slice(0, 7)) {
  const keys = new Set();
  const cursor = new Date(`${ROUTE_HEALTH_HISTORY_START}-01T12:00:00`);
  const current = new Date(`${currentMonth}-01T12:00:00`);

  while (cursor <= current) {
    keys.add(dateKey(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const key of Object.keys(field.healthLog || {})) {
    const month = key.slice(0, 7);
    if (month >= ROUTE_HEALTH_HISTORY_START && month <= currentMonth) keys.add(month);
  }
  for (const snapshot of report.snapshots || []) {
    for (const day of Object.values(snapshot.health?.days || {})) {
      const month = day.date?.slice(0, 7);
      if (month >= ROUTE_HEALTH_HISTORY_START && month <= currentMonth) keys.add(month);
    }
  }
  if (!keys.size) keys.add(currentMonth);
  return [...keys].filter(Boolean).sort().reverse();
}

function accountWorkGroups(field, date) {
  const groups = new Map();
  const ensure = (accountId) => {
    if (!accountId || !field.accounts[accountId]) return null;
    if (!groups.has(accountId)) groups.set(accountId, new Set());
    return groups.get(accountId);
  };
  const add = (accountId, detail) => {
    const group = ensure(accountId);
    if (group && detail) group.add(detail);
  };

  for (const visit of Object.values(field.visits)) {
    if (visit.date === date) add(visit.accountId, "Visit completed");
  }
  for (const [accountId, records] of Object.entries(field.compliance)) {
    const completed = COMPLIANCE_ITEMS
      .filter((item) => {
        const record = records[item.id];
        return (record?.completedOn || (record?.completedAt ? dateKey(record.completedAt) : "")) === date;
      })
      .map((item) => item.label);
    if (completed.length) add(accountId, `Compliance: ${completed.join("; ")}`);
  }
  for (const note of Object.values(field.notes)) {
    if (note.createdAt && dateKey(note.createdAt) === date) {
      add(note.accountId, `Note (${note.type}): ${note.body}`);
    }
  }
  for (const task of Object.values(field.tasks)) {
    if (task.doneAt && dateKey(task.doneAt) === date) add(task.accountId, `Task completed: ${task.title}`);
  }
  for (const followUp of Object.values(field.followUps)) {
    if (followUp.doneAt && dateKey(followUp.doneAt) === date) {
      add(followUp.accountId, `Follow-up completed: ${followUp.title}`);
    }
  }
  const finalOpportunityStates = new Map();
  for (const item of field.activity) {
    if (!item.createdAt || dateKey(item.createdAt) !== date || !item.accountId) continue;
    if (item.type === "pricing") {
      add(item.accountId, [item.title, item.detail].filter(Boolean).join(": "));
    }
    if (item.type === "opportunity") {
      const key = `${item.accountId}\u001f${item.title}`;
      const current = finalOpportunityStates.get(key);
      if (!current || String(item.createdAt).localeCompare(String(current.createdAt)) > 0) {
        finalOpportunityStates.set(key, item);
      }
    }
  }
  for (const item of finalOpportunityStates.values()) {
    add(item.accountId, [item.title, normalizeOpportunityState(item.detail)].filter(Boolean).join(": "));
  }
  return groups;
}

export function buildDaySummary(field, date = dateKey()) {
  const groups = accountWorkGroups(field, date);
  const dayId = routeDayForDate(new Date(`${date}T12:00:00`));
  const routeOrder = field.routes[dayId] || [];
  const orderedAccountIds = [
    ...routeOrder.filter((accountId) => groups.has(accountId)),
    ...[...groups.keys()].filter((accountId) => !routeOrder.includes(accountId))
  ];
  const lines = [formatLongDate(new Date(`${date}T12:00:00`))];

  for (const accountId of orderedAccountIds) {
    const account = field.accounts[accountId];
    const identity = account.accountNumber ? ` (Acct ${account.accountNumber})` : "";
    lines.push("", `${displayAccountName(account)}${identity}`);
    for (const detail of groups.get(accountId)) lines.push(`- ${detail}`);
  }
  if (!orderedAccountIds.length) lines.push("", "No account activity was recorded.");
  if (field.dayNotes[date]) lines.push("", `Manager context: ${field.dayNotes[date]}`);
  return lines.join("\n");
}

function accountPerformanceContent(field, report, selectedPeriod) {
  const metrics = performanceMetrics(report.current.performance, selectedPeriod);
  const currentKey = `${metrics.period}Current`;
  const deltaKey = `${metrics.period}Delta`;
  const rows = Object.entries(report.current.performance?.accounts || {})
    .map(([accountId, data]) => ({
      accountId,
      account: field.accounts[accountId],
      summary: data.summary || {}
    }))
    .filter((item) => item.account)
    .sort((left, right) => Number(left.summary[deltaKey] || 0) - Number(right.summary[deltaKey] || 0));

  if (!rows.length) {
    return `<div class="panel--pad account-performance__empty">
      <p>Import and match Account Performance to compare accounts here.</p>
      <button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-spreadsheet", 16)}Import report</button>
    </div>`;
  }

  return `<div class="account-performance">
    ${performancePeriodControl(metrics)}
    ${rows.map(({ accountId, account, summary }) => {
      const delta = Number(summary[deltaKey]) || 0;
      return `<button class="account-performance__row" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(accountId)}" data-tab="details">
        <span class="account-performance__identity">
          <b>${escapeHtml(displayAccountName(account))}</b>
          <small>${escapeHtml([account.type, account.town].filter(Boolean).join(" / "))}</small>
        </span>
        <span class="account-performance__value">
          <b>${Number(summary[currentKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</b>
          <small>${escapeHtml(metrics.valueLabel)}</small>
          <small class="delta ${delta >= 0 ? "delta--up" : "delta--down"}">${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}% ${escapeHtml(metrics.comparisonLabel)}</small>
        </span>
        ${icon("chevron-right", 17)}
      </button>`;
    }).join("")}
  </div>`;
}

function accountPerformanceSection(field, report, selectedPeriod, expandedDetails) {
  const matchedCount = Object.keys(report.current.performance?.accounts || {})
    .filter((accountId) => field.accounts[accountId]).length;
  if (!matchedCount) return panel(accountPerformanceContent(field, report, selectedPeriod));
  const metrics = performanceMetrics(report.current.performance, selectedPeriod);
  const disclosureId = "activity:account-performance";
  return `<details class="panel detail-accordion account-performance-disclosure" data-disclosure-id="${disclosureId}" ${expandedDetails?.has(disclosureId) ? "open" : ""}>
    <summary>
      <span><b>${matchedCount} matched account${matchedCount === 1 ? "" : "s"}</b><small>${metrics.period.toUpperCase()} · ${escapeHtml(metrics.valueLabel)}</small></span>
      ${icon("chevron-down")}
    </summary>
    <div class="detail-card__body">${accountPerformanceContent(field, report, selectedPeriod)}</div>
  </details>`;
}

function portfolioPerformanceContent(report, selectedPeriod) {
  const performance = report.current.segmentPerformance;
  const metrics = performanceMetrics(performance, selectedPeriod);
  const currentKey = `${metrics.period}Current`;
  const deltaKey = `${metrics.period}Delta`;
  const segments = performance?.segments || [];
  if (!segments.length) {
    return `<div class="panel--pad route-performance__empty">
      <p>Import Segment Performance to see route-wide MTD and YTD movement.</p>
      <button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-spreadsheet", 16)}Import report</button>
    </div>`;
  }
  const maximum = Math.max(1, ...segments.map((segment) => Number(segment[currentKey]) || 0));
  return `<div class="panel--pad portfolio-performance">
    ${performancePeriodControl(metrics)}
    <p class="performance-period__note">Route-wide ${escapeHtml(metrics.valueLabel)} by segment.</p>
    ${segments.map((segment) => {
      const current = Number(segment[currentKey]) || 0;
      const delta = Number(segment[deltaKey]) || 0;
      return `<div class="portfolio-performance__row">
        <div class="progress-head">
          <span><b>${escapeHtml(segment.name)}</b><small>${segment.items.length} brand${segment.items.length === 1 ? "" : "s"}</small></span>
          <strong><b>${current.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><small class="delta ${delta >= 0 ? "delta--up" : "delta--down"}">${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%</small></strong>
        </div>
        ${progressBar((current / maximum) * 100, delta >= 0 ? "pine" : "")}
      </div>`;
    }).join("")}
  </div>`;
}

function portfolioPerformanceSection(report, selectedPeriod, expandedDetails) {
  const segments = report.current.segmentPerformance?.segments || [];
  if (!segments.length) return panel(portfolioPerformanceContent(report, selectedPeriod));
  const metrics = performanceMetrics(report.current.segmentPerformance, selectedPeriod);
  const disclosureId = "activity:portfolio-performance";
  return `<details class="panel detail-accordion portfolio-performance-disclosure" data-disclosure-id="${disclosureId}" ${expandedDetails?.has(disclosureId) ? "open" : ""}>
    <summary>
      <span><b>${segments.length} route segment${segments.length === 1 ? "" : "s"}</b><small>${metrics.period.toUpperCase()} · ${escapeHtml(metrics.valueLabel)}</small></span>
      ${icon("chevron-down")}
    </summary>
    <div class="detail-card__body">${portfolioPerformanceContent(report, selectedPeriod)}</div>
  </details>`;
}

function customerMoversContent(field, report, selectedPeriod, selectedDirection = "declines") {
  const movers = report.current.customerMovers;
  const metrics = performanceMetrics(movers, selectedPeriod);
  const currentKey = `${metrics.period}Current`;
  const deltaKey = `${metrics.period}Delta`;
  const rows = Object.entries(movers?.accounts || {})
    .map(([accountId, data]) => ({ accountId, account: field.accounts[accountId], summary: data.summary || {} }))
    .filter((item) => item.account);
  if (!rows.length) {
    return `<div class="panel--pad account-performance__empty">
      <p>Import Customer Movers and resolve uncertain matches to see gains and losses.</p>
      <button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-spreadsheet", 16)}Import report</button>
    </div>`;
  }
  const direction = selectedDirection === "gains" ? "gains" : "declines";
  const selected = rows
    .filter((item) => direction === "gains"
      ? Number(item.summary[deltaKey] || 0) >= 0
      : Number(item.summary[deltaKey] || 0) < 0)
    .sort((left, right) => direction === "gains"
      ? Number(right.summary[deltaKey] || 0) - Number(left.summary[deltaKey] || 0)
      : Number(left.summary[deltaKey] || 0) - Number(right.summary[deltaKey] || 0))
    .slice(0, 5);
  return `<div class="customer-movers">
    <div class="panel--pad customer-movers__intro">
      ${performancePeriodControl(metrics)}
      ${segmented([
        { id: "declines", label: "Declines" },
        { id: "gains", label: "Gains" }
      ], direction, "select-customer-mover-direction")}
      <p class="performance-period__note">Biggest confirmed ${direction} from the current report.</p>
    </div>
    ${selected.length ? selected.map(({ accountId, account, summary }) => {
      const delta = Number(summary[deltaKey]) || 0;
      return `<button class="account-performance__row" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(accountId)}" data-tab="details">
        <span class="account-performance__identity"><b>${escapeHtml(displayAccountName(account))}</b><small>${escapeHtml([account.type, account.town].filter(Boolean).join(" · "))}</small></span>
        <span class="account-performance__value"><b>${Number(summary[currentKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><small class="delta ${delta >= 0 ? "delta--up" : "delta--down"}">${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%</small></span>
        ${icon("chevron-right", 17)}
      </button>`;
    }).join("") : `<p class="customer-movers__empty">No confirmed ${direction} in this report.</p>`}
  </div>`;
}

function eliteExecutionContent(field, report, expandedDetails) {
  const assignments = Object.entries(report.current.eliteAssignments?.accounts || {})
    .flatMap(([accountId, group]) => (group.items || []).map((item) => ({
      ...item,
      accountId,
      account: field.accounts[accountId],
      completed: Boolean(field.eliteStates[item.id]?.completedAt),
      rejected: String(item.sourceStatus || "").trim().toLowerCase() === "rejected"
    })))
    .filter((item) => item.account)
    .sort((left, right) => String(left.category).localeCompare(String(right.category)) || String(left.dueDate || "").localeCompare(String(right.dueDate || "")) || left.title.localeCompare(right.title));
  if (!assignments.length) {
    return `<div class="panel--pad route-performance__empty">
      <p>Import the Elite assignment snapshot to work objectives by account and type.</p>
      <button class="btn btn--secondary btn--small" type="button" data-action="navigate" data-route="import">${icon("file-up", 16)}Import Elite</button>
    </div>`;
  }
  const actionable = assignments.filter((item) => !item.rejected);
  const completed = actionable.filter((item) => item.completed).length;
  const categories = new Map();
  for (const item of assignments) {
    const key = item.category || "General";
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(item);
  }
  return `<div class="elite-execution">
    <div class="panel--pad elite-execution__summary">
      <div class="progress-head"><span><b>${completed} of ${actionable.length} complete</b><small>Local progress is retained when assignments refresh.</small></span><strong>${actionable.length ? Math.round((completed / actionable.length) * 100) : 0}%</strong></div>
      <div style="margin-top:10px">${progressBar(actionable.length ? (completed / actionable.length) * 100 : 0, "pine")}</div>
    </div>
    <div class="elite-execution__list">
      ${[...categories].map(([category, items]) => {
        const disclosureId = `activity:elite:${category}`;
        const open = items.filter((item) => !item.completed && !item.rejected).length;
        return `<details class="elite-execution__group" data-disclosure-id="${escapeHtml(disclosureId)}" ${expandedDetails?.has(disclosureId) ? "open" : ""}>
          <summary><span><b>${escapeHtml(category)}</b><small>${open} open · ${items.length} assigned</small></span>${icon("chevron-down", 16)}</summary>
          <div class="elite-execution__items">
            ${items.map((item) => `<button class="task-row ${item.completed ? "is-done" : ""} ${item.rejected ? "is-muted" : ""}" type="button" data-action="toggle-elite" data-assignment-id="${escapeHtml(item.id)}" data-account-id="${escapeHtml(item.accountId)}" data-title="${escapeHtml(item.title)}" data-category="${escapeHtml(item.category)}" ${item.rejected ? "disabled" : ""}>
              <span class="task-row__state">${item.completed ? icon("check", 15) : item.rejected ? icon("x", 15) : ""}</span>
              <span class="task-row__body"><span class="task-row__title">${escapeHtml(item.title)}</span><span class="task-row__detail">${escapeHtml(displayAccountName(item.account))}${item.dueLabel ? ` · ${escapeHtml(item.dueLabel)}` : item.dueDate ? ` · ${formatShortDate(item.dueDate)}` : ""}</span></span>
            </button>`).join("")}
          </div>
        </details>`;
      }).join("")}
    </div>
  </div>`;
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

function pfpScorecardContent(field, report, { includeHero = true } = {}) {
  const scorecard = projectPfpScorecard(field, report);
  if (!scorecard) {
    return `<div class="panel--pad pfp-empty">
      ${emptyState({
        iconName: "badge-dollar-sign",
        title: "No PFP snapshot yet",
        message: "Import the current monthly scorecard to track volume gates and validated execution."
      })}
      <button class="btn btn--secondary btn--full" type="button" data-action="navigate" data-route="import">${icon("file-up", 16)}Import PFP snapshot</button>
    </div>`;
  }
  const gateOpportunities = scorecard.buckets
    .filter((bucket) => bucket.attainment < 0.7 && bucket.goal > 0)
    .map((bucket) => ({
      ...bucket,
      needed: Math.max(0, (bucket.goal * 0.7) - bucket.actual),
      unlock: bucket.potential * 0.25
    }))
    .sort((left, right) => right.unlock - left.unlock);
  return `<div class="panel--pad pfp-scorecard">
    ${includeHero ? `<div class="pfp-scorecard__hero">
      <span><small>${escapeHtml(scorecard.period)} projection</small><strong>${money(scorecard.estimatedPay)}</strong><small>${money(scorecard.remainingPotential)} potential remaining</small></span>
      ${badge("Not committed pay", "open")}
    </div>` : ""}
    <div class="pfp-pools">
      <span><small>Volume projection</small><b>${money(scorecard.volumePay)} / $900</b></span>
      <span><small>Execution projection</small><b>${money(scorecard.executionPay)} / $600</b></span>
    </div>
    <div class="pfp-buckets">
      ${scorecard.buckets.map((bucket) => `<div class="pfp-bucket">
        <div class="progress-head"><span><b>${escapeHtml(bucket.label)}</b><small>${bucket.actual.toLocaleString(undefined, { maximumFractionDigits: 1 })} of ${bucket.goal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</small></span><strong class="${bucket.attainment >= 0.7 ? "delta--up" : "delta--down"}">${Math.round(bucket.attainment * 100)}%</strong></div>
        <div class="pfp-gated-progress">
          ${progressBar(Math.min(100, bucket.attainment * 100), bucket.attainment >= 0.7 ? "pine" : "")}
          <span class="pfp-gate-marker" aria-label="70 percent payout gate"><small>70% gate</small></span>
        </div>
      </div>`).join("")}
    </div>
    ${gateOpportunities.length ? `<div class="pfp-opportunities">
      <span class="t-cap">Closest money to unlock</span>
      ${gateOpportunities.slice(0, 3).map((bucket) => `<div class="pfp-opportunity"><span><b>${escapeHtml(bucket.label)}</b><small>${bucket.needed.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${bucket.measure === "Gross profit dollars" ? "GP dollars" : "CE"} to the 70% gate</small></span><strong>+${money(bucket.unlock)}</strong></div>`).join("")}
    </div>` : ""}
    <div class="pfp-execution">
      <div class="progress-head"><span><b>Projected execution</b><small>${scorecard.sourceExecutionCompleted} source validated + ${scorecard.localExecutionCompleted} locally complete</small></span><strong>${Math.round(scorecard.executionAttainment * 100)}%</strong></div>
      ${progressBar(scorecard.executionAttainment * 100, "pine")}
      ${scorecard.campaigns?.length ? `<div class="pfp-campaigns">${scorecard.campaigns.map((campaign) => `<span><b>${escapeHtml(campaign.name)}</b><small>${campaign.completed}/${campaign.assigned} projected${campaign.localProjected ? ` · ${campaign.localProjected} local` : ""} · ${escapeHtml(campaign.type)}</small></span>`).join("")}</div>` : ""}
    </div>
  </div>`;
}

function pfpScorecardSection(field, report, expandedDetails) {
  const scorecard = projectPfpScorecard(field, report);
  if (!scorecard) return panel(pfpScorecardContent(field, report));
  const disclosureId = "activity:pfp";
  return `<details class="panel detail-accordion pfp-disclosure" data-disclosure-id="${disclosureId}" ${expandedDetails?.has(disclosureId) ? "open" : ""}>
    <summary class="pfp-disclosure__summary">
      <span>
        <b>${money(scorecard.estimatedPay)} projected</b>
        <small>${escapeHtml(scorecard.period)} · ${money(scorecard.remainingPotential)} potential remaining · not committed pay</small>
      </span>
      ${icon("chevron-down")}
    </summary>
    <div class="detail-card__body">${pfpScorecardContent(field, report, { includeHero: false })}</div>
  </details>`;
}

export function renderActivity(state, context = {}) {
  const { field, report } = state;
  const today = dateKey();
  const healthMonths = availableHealthMonths(field, report, today.slice(0, 7));
  const requestedMonth = context.activityMonth || today.slice(0, 7);
  const selectedMonth = healthMonths.includes(requestedMonth) ? requestedMonth : healthMonths[0];
  const month = new Date(`${selectedMonth}-01T12:00:00`);
  const visits = Object.values(field.visits).filter((visit) => visit.date === today);
  const notesToday = Object.values(field.notes).filter((note) => note.createdAt && dateKey(note.createdAt) === today);
  const tasksToday = Object.values(field.tasks).filter((task) => task.doneAt && dateKey(task.doneAt) === today);
  const openFollowUps = Object.values(field.followUps).filter((item) => !item.doneAt);
  const activity = field.activity
    .filter((item) => item.createdAt && dateKey(item.createdAt) === today)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const summary = buildDaySummary(field, today);
  const recentExpanded = context.expandedDetails?.has("activity:today");

  const content = `${sectionHeading("Route health")}
    ${panel(`<div class="panel--pad">
      <div class="section-row">
        <label class="month-picker" data-label="${escapeHtml(monthLabel(selectedMonth))}">
          <span class="sr-only">Route health month</span>
          <select data-input="health-month" aria-label="Route health month">
            ${healthMonths.map((key) => `<option value="${key}" ${key === selectedMonth ? "selected" : ""}>${monthLabel(key)}</option>`).join("")}
          </select>
          ${icon("chevron-down", 16)}
        </label>
        ${badge("Done = route finished", "done")}
      </div>
      <span class="t-sub">Readiness grade by route day</span>
      <div class="health-calendar-wrap">${healthCalendar(field, report, month)}</div>
    </div>`)}

    ${sectionHeading("Today")}
    ${panel(`<div class="panel--pad">
      <div class="activity-stats">
        <span class="activity-stat activity-stat--done"><strong>${visits.length}</strong><span>Visits</span></span>
        <span class="activity-stat"><strong>${notesToday.length}</strong><span>Notes</span></span>
        <span class="activity-stat"><strong>${tasksToday.length}</strong><span>Tasks</span></span>
        <span class="activity-stat ${openFollowUps.length ? "activity-stat--attention" : "activity-stat--done"}"><strong>${openFollowUps.length}</strong><span>Follow-ups</span></span>
      </div>
      <div class="field">
        <label for="day-note">Manager-ready context</label>
        <textarea id="day-note" data-input="day-note" placeholder="One sentence about the day">${escapeHtml(field.dayNotes[today] || "")}</textarea>
      </div>
      <div class="summary-copy" tabindex="0" role="region" aria-label="End-of-day summary">${escapeHtml(summary)}</div>
      <button class="btn btn--primary btn--full" type="button" data-action="copy-summary">${icon("copy")}Copy end-of-day summary</button>
    </div>`)}

    ${sectionHeading("Follow-up inbox", `<button class="btn btn--small btn--quiet" data-action="navigate" data-route="followups">Open</button>`)}
    ${panel(openFollowUps.length ? openFollowUps.slice(0, 3).map((item) => {
      const account = field.accounts[item.accountId];
      return `<button class="list-row" type="button" data-action="open-account" data-account-id="${escapeHtml(item.accountId)}">
        <span class="list-row__body">
          <span class="list-row__title">${escapeHtml(item.title)}</span>
          <span class="list-row__detail">${escapeHtml(account ? displayAccountName(account) : "Unknown account")} / ${formatShortDate(item.dueDate)}</span>
        </span>
        ${icon("chevron-right", 17)}
      </button>`;
    }).join("") : emptyState({
      iconName: "calendar-check",
      title: "Follow-ups are clear",
      message: "Future dated actions will collect here."
    }))}

    ${sectionHeading("PFP scorecard")}
    ${pfpScorecardSection(field, report, context.expandedDetails)}

    ${sectionHeading("Elite execution")}
    <details class="panel detail-accordion" data-disclosure-id="activity:elite" ${context.expandedDetails?.has("activity:elite") ? "open" : ""}>
      <summary><span><b>Objectives by type</b><small>Imported assignments with protected local completion</small></span>${icon("chevron-down")}</summary>
      <div class="detail-card__body">${eliteExecutionContent(field, report, context.expandedDetails)}</div>
    </details>

    ${sectionHeading("Portfolio performance")}
    ${portfolioPerformanceSection(report, context.performancePeriod || "ytd", context.expandedDetails)}

    ${sectionHeading("Customer movers")}
    <details class="panel detail-accordion" data-disclosure-id="activity:movers" ${context.expandedDetails?.has("activity:movers") ? "open" : ""}>
      <summary><span><b>Biggest gains and declines</b><small>Confirmed accounts only</small></span>${icon("chevron-down")}</summary>
      <div class="detail-card__body">${customerMoversContent(field, report, context.performancePeriod || "ytd", context.customerMoverDirection)}</div>
    </details>

    ${sectionHeading("Account performance")}
    ${accountPerformanceSection(field, report, context.performancePeriod || "ytd", context.expandedDetails)}

    ${sectionHeading("Today's activity")}
    <details class="panel detail-accordion activity-log" data-disclosure-id="activity:today" ${recentExpanded ? "open" : ""}>
      <summary>
        <span><b>Field timeline</b><small>${activity.length} event${activity.length === 1 ? "" : "s"} recorded today</small></span>
        ${icon("chevron-down")}
      </summary>
      <div class="activity-log__body">
        ${activity.length ? `<div class="timeline">
          ${activity.slice(0, 30).map((item) => `<div class="timeline__item">
            <span class="timeline__rail"><span class="timeline__dot"></span><span class="timeline__line"></span></span>
            <span class="timeline__body">
              <time>${formatDateTime(item.createdAt)}</time>
              <p>${escapeHtml(item.title)}</p>
              <small>${escapeHtml(item.detail || item.type)}</small>
            </span>
          </div>`).join("")}
        </div>` : emptyState({
          iconName: "history",
          title: "No activity today",
          message: "Visits, notes, tasks, pricing, compliance, and opportunity changes will appear here."
        })}
      </div>
    </details>`;

  return appScreen({
    route: "activity",
    field,
    ambient: "pine",
    header: screenHeader({
      eyebrow: "Field journal",
      title: "Activity",
      subtitle: "What happened, and what needs another look."
    }),
    content,
    isOnline: context.isOnline
  });
}

export function renderFollowUps(state, context = {}) {
  const { field } = state;
  const today = dateKey();
  const items = Object.values(field.followUps)
    .filter((item) => !item.doneAt)
    .sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")));
  const groups = [
    { id: "overdue", label: "Overdue", items: items.filter((item) => item.dueDate < today) },
    { id: "today", label: "Today", items: items.filter((item) => item.dueDate === today) },
    { id: "later", label: "Later", items: items.filter((item) => !item.dueDate || item.dueDate > today) }
  ];
  const content = items.length ? groups.map((group) => group.items.length ? `
    ${sectionHeading(group.label)}
    ${panel(group.items.map((item) => {
      const account = field.accounts[item.accountId];
      return `<div class="task-row ${group.id === "overdue" ? "is-urgent" : ""}">
        <button class="task-row__state task-row__state--button" type="button" data-action="complete-followup" data-followup-id="${escapeHtml(item.id)}" aria-label="Complete follow-up"></button>
        <button class="task-row__body" type="button" data-action="open-account" data-account-id="${escapeHtml(item.accountId)}">
          <span class="task-row__title">${escapeHtml(item.title)}</span>
          <span class="task-row__detail">${escapeHtml(account ? displayAccountName(account) : "Unknown account")} / ${formatShortDate(item.dueDate)}</span>
        </button>
      </div>`;
    }).join(""))}` : "").join("") : panel(emptyState({
      iconName: "calendar-check",
      title: "Follow-up inbox is clear",
      message: "Add a follow-up date to any structured note to put it here."
    }));

  return appScreen({
    route: "followups",
    field,
    ambient: "amber",
    header: screenHeader({
      eyebrow: `${items.length} open`,
      title: "Follow-ups",
      subtitle: "A single inbox across every account.",
      back: true
    }),
    content,
    isOnline: context.isOnline
  });
}
