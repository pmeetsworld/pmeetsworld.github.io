import { REPORT_TYPES } from "../../config.js?v=1.1.0";
import { formatDateTime } from "../../domain/dates.js?v=1.1.0";
import {
  appScreen,
  emptyState,
  escapeHtml,
  icon,
  panel,
  screenHeader,
  segmented,
  sectionHeading
} from "../components.js?v=1.1.0";

function stagedSummary(item) {
  if (item.error) return escapeHtml(item.error);
  const label = escapeHtml(REPORT_TYPES[item.type].label);
  const { accountCount, itemCount, matchedCount, reviewCount } = item.report;
  if (item.type === "eliteAssignments") {
    return `${label} · ${itemCount} assignments · ${matchedCount} account${matchedCount === 1 ? "" : "s"} · ${reviewCount} review`;
  }
  if (accountCount) return `${label} · ${matchedCount} matched · ${reviewCount} review`;
  return `${label} · ${itemCount} records`;
}

function reportTab(state, context) {
  const staged = context.stagedImports || [];
  return `<div class="import-intro panel panel--pad">
      <h2 class="h-card">Replace report data, protect field work</h2>
      <p class="t-body">Choose Excel work reports, the Perfect Launch CSV, or a structured Elite, Preorder, or PFP JSON snapshot. Matching is exact; uncertain accounts go to Review.</p>
      <label class="btn btn--primary btn--full">
        ${icon("file-up")}Choose report files
        <input class="import-report__input" type="file" accept=".xlsx,.xls,.csv,.json" multiple data-input="report-files">
      </label>
      <div class="import-pack">
        <span><b>August execution pack</b><small>Your supplied Elite, preorder, PFP, and Perfect Launch sources. Optional and never loaded on first open.</small></span>
        <button class="btn btn--secondary btn--full" type="button" data-action="stage-execution-pack">${icon("package-open")}Stage current pack</button>
      </div>
    </div>

    ${staged.length ? `${sectionHeading("Ready to import")}
      ${panel(staged.map((item) => `<div class="list-row">
        ${icon(item.error ? "circle-alert" : "file-spreadsheet")}
        <span class="list-row__body">
          <span class="list-row__title">${escapeHtml(item.fileName)}</span>
          <span class="list-row__detail">${stagedSummary(item)}</span>
        </span>
      </div>`).join(""))}
      <button class="btn btn--primary btn--full import-commit" type="button" data-action="commit-imports" ${staged.every((item) => item.error) ? "disabled" : ""}>${icon("database")}Commit report replacement</button>
    ` : `${sectionHeading("Supported reports")}
      <details class="panel detail-accordion import-supported" data-disclosure-id="import:supported" ${context.expandedDetails?.has("import:supported") ? "open" : ""}>
        <summary><span><b>${Object.keys(REPORT_TYPES).length} report formats</b><small>Excel, CSV, and structured snapshots</small></span>${icon("chevron-down")}</summary>
        <div class="detail-card__body">
          ${Object.values(REPORT_TYPES).map((type) => `<div class="list-row">
            ${icon("table-2")}
            <span class="list-row__body"><span class="list-row__title">${escapeHtml(type.label)}</span><span class="list-row__detail">${type.id === "perfectLaunchCatalog" ? "CSV product context" : ["eliteAssignments", "preorders", "pfpScorecard"].includes(type.id) ? "Structured JSON snapshot" : "Excel sheet and headers"}</span></span>
          </div>`).join("")}
        </div>
      </details>`}`;
}

function historyTab(report) {
  const snapshots = [...report.snapshots].sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
  return snapshots.length ? `${sectionHeading("Snapshots")}
    ${panel(snapshots.map((snapshot) => `<button class="list-row" type="button" data-action="open-snapshot" data-snapshot-id="${escapeHtml(snapshot.id)}">
      ${icon("history")}
      <span class="list-row__body">
        <span class="list-row__title">${escapeHtml(REPORT_TYPES[snapshot.type]?.label || snapshot.type)}</span>
        <span class="list-row__detail">${escapeHtml(snapshot.fileName)} · ${snapshot.accountCount ? `${snapshot.accountCount} account groups` : `${snapshot.itemCount} records`} · ${formatDateTime(snapshot.importedAt)}</span>
      </span>
      ${icon("chevron-right", 17)}
    </button>`).join(""))}` : panel(emptyState({
      iconName: "history",
      title: "No report snapshots",
      message: "Each committed report replacement creates a dated, reconstructible snapshot."
    }));
}

function reviewTab(state) {
  const { field, report } = state;
  const items = Object.values(report.review)
    .filter((item) => item.status === "pending")
    .sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  const accounts = Object.values(field.accounts).sort((a, b) => a.name.localeCompare(b.name));
  return items.length ? `${sectionHeading(`${items.length} waiting`)}
    ${panel(items.map((item) => `<div class="review-card" data-review-card="${escapeHtml(item.id)}">
      <span class="t-cap">${escapeHtml(REPORT_TYPES[item.reportType]?.label || item.reportType)}</span>
      <h2 class="h-card" style="margin-top:4px">${escapeHtml(item.sourceName)}</h2>
      <p class="review-card__suggestion">${escapeHtml(item.reason)} · ${item.group.items.length} child row${item.group.items.length === 1 ? "" : "s"} preserved</p>
      ${accounts.length ? `<div class="field">
        <label for="review-${escapeHtml(item.id)}">Confirm an account</label>
        <select id="review-${escapeHtml(item.id)}" data-review-select="${escapeHtml(item.id)}">
          <option value="">Choose account</option>
          ${accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.nickname || account.name)}${account.accountNumber ? ` · ${escapeHtml(account.accountNumber)}` : ""}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="review-card__actions">
        ${accounts.length ? `<button class="btn btn--secondary btn--small" type="button" data-action="link-review" data-review-id="${escapeHtml(item.id)}">Link selected</button>` : ""}
        <button class="btn btn--primary btn--small" type="button" data-action="create-review-account" data-review-id="${escapeHtml(item.id)}">${icon("user-plus", 15)}Create account</button>
        <button class="btn btn--quiet btn--small" type="button" data-action="exclude-review" data-review-id="${escapeHtml(item.id)}">Exclude explicitly</button>
      </div>
    </div>`).join(""))}` : panel(emptyState({
      iconName: "badge-check",
      title: "Review is clear",
      message: "Every imported group is matched, explicitly excluded, or waiting in a future import."
    }));
}

export function renderImport(state, context = {}) {
  const { field, report, ui } = state;
  const tabs = [
    { id: "reports", label: "Reports" },
    { id: "history", label: "History" },
    { id: "review", label: `Review${Object.values(report.review).some((item) => item.status === "pending") ? " •" : ""}` }
  ];
  const content = ui.importTab === "history"
    ? historyTab(report)
    : ui.importTab === "review"
      ? reviewTab(state)
      : reportTab(state, context);
  return appScreen({
    route: "import",
    field,
    ambient: "amber",
    header: screenHeader({
      eyebrow: "Report layer",
      title: "Import",
      subtitle: "Certain matches only. Field work stays untouched.",
      back: true
    }),
    controls: `<div class="account-tabs">${segmented(tabs, ui.importTab, "select-import-tab")}</div>`,
    content,
    isOnline: context.isOnline
  });
}
