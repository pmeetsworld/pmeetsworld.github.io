import { isOpenOpportunityState } from "../../config.js?v=1.1.0";
import { dateKey, dayDefinition } from "../../domain/dates.js?v=1.1.0";
import { computeAccountHealth, reportOpportunitiesForAccount, visitKey } from "../../domain/health.js?v=1.1.0";
import { opportunityStateId } from "../../domain/identity.js?v=1.1.0";
import {
  accountSecondary,
  appScreen,
  daySegments,
  displayAccountName,
  emptyState,
  escapeHtml,
  gradeChip,
  icon,
  panel,
  screenHeader
} from "../components.js?v=1.1.0";

function complianceSignal(field, accountId) {
  const records = field.compliance[accountId] || {};
  const survey = records["merch-space"]?.completedAt;
  const outOfCode = records["out-of-code"]?.completedAt;
  return {
    surveyDone: Boolean(survey),
    outOfCodeNeeded: !outOfCode
  };
}

function accountRows(state) {
  const { field, report, ui } = state;
  const today = dateKey();
  const routeIds = (field.routes[ui.routeDay] || []).filter((id) => field.accounts[id]);
  const search = ui.search.trim().toLowerCase();
  let rows = routeIds.map((accountId, index) => {
    const account = field.accounts[accountId];
    const health = computeAccountHealth({ accountId, field, report, asOf: today });
    const compliance = complianceSignal(field, accountId);
    const opportunityCount = reportOpportunitiesForAccount(report, accountId).filter((item) => {
      const stateId = opportunityStateId(accountId, item);
      const value = field.opportunityStates[stateId] || "Open";
      return isOpenOpportunityState(value);
    }).length;
    return {
      account,
      accountId,
      order: index + 1,
      visited: Boolean(field.visits[visitKey(accountId, today)]),
      health,
      compliance,
      opportunityCount
    };
  });

  if (search) {
    rows = rows.filter(({ account }) => [
      account.name,
      account.nickname,
      account.accountNumber,
      account.storeNumber,
      account.town
    ].some((value) => String(value || "").toLowerCase().includes(search)));
  }

  const sorters = {
    order: (a, b) => a.order - b.order,
    notDone: (a, b) => Number(a.visited) - Number(b.visited) || a.order - b.order,
    health: (a, b) => (a.health.score ?? -1) - (b.health.score ?? -1),
    survey: (a, b) => Number(a.compliance.surveyDone) - Number(b.compliance.surveyDone),
    outOfCode: (a, b) => Number(b.compliance.outOfCodeNeeded) - Number(a.compliance.outOfCodeNeeded),
    opportunities: (a, b) => b.opportunityCount - a.opportunityCount
  };
  return rows.sort(sorters[ui.sort] || sorters.order);
}

export function renderRoute(state, context = {}) {
  const { field, ui } = state;
  const day = dayDefinition(ui.routeDay);
  const rows = accountRows(state);
  const scheduled = (field.routes[ui.routeDay] || []).length;
  const controls = `<div class="route-controls">
    ${daySegments(ui.routeDay)}
    <div class="route-toolbar">
      <label class="search-control">
        ${icon("search", 18)}
        <span class="sr-only">Search route</span>
        <input
          type="search"
          value="${escapeHtml(ui.search)}"
          placeholder="Name, nickname, number, or town"
          data-input="route-search"
        >
      </label>
      <button class="icon-btn" type="button" data-action="open-sort" aria-label="Sort route">${icon("arrow-up-down")}</button>
    </div>
  </div>`;

  const content = rows.length
    ? `<div class="route-list panel">
        ${rows.map((row) => {
          const signals = [
            row.compliance.surveyDone ? "Survey current" : "Survey due",
            row.compliance.outOfCodeNeeded ? "OOC walk due" : "OOC current",
            `${row.opportunityCount} opp${row.opportunityCount === 1 ? "" : "s"}`
          ];
          return `<button
            class="account-row ${row.visited ? "is-visited" : ""}"
            type="button"
            data-action="open-account"
            data-account-id="${escapeHtml(row.accountId)}"
          >
            <span class="account-row__order">${row.visited ? icon("check", 15) : row.order}</span>
            <span class="account-row__body">
              <span class="account-row__title">${escapeHtml(displayAccountName(row.account))}</span>
              <span class="account-row__detail">${escapeHtml(accountSecondary(row.account))}</span>
              <span class="account-row__signal">${escapeHtml(signals.join(" · "))}</span>
            </span>
            <span class="account-row__end">${gradeChip(row.health, 30)}${icon("chevron-right", 16)}</span>
          </button>`;
        }).join("")}
      </div>
      <div style="height:12px"></div>
      <button class="btn btn--primary btn--full" type="button" data-action="start-route" data-day="${ui.routeDay}">
        ${icon("navigation")}Start next stop
      </button>`
    : panel(emptyState({
      iconName: scheduled ? "search-x" : "map-pin-plus",
      title: scheduled ? "No matching stops" : `${day.label} is open`,
      message: scheduled
        ? "Try another name, account number, store number, or town."
        : "Add an existing account to this day in the route editor.",
      action: scheduled ? "clear-search" : "navigate",
      actionLabel: scheduled ? "Clear search" : "Edit route"
    }));

  return appScreen({
    route: "route",
    field,
    ambient: "slate",
    header: screenHeader({
      eyebrow: `${scheduled} scheduled`,
      title: "My Route",
      subtitle: `${day.label} field plan`
    }),
    controls,
    content,
    isOnline: context.isOnline
  });
}
