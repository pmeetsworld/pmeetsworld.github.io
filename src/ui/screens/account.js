import {
  COMPLIANCE_ITEMS,
  isOpenOpportunityState,
  normalizeOpportunityState,
  NOTE_TYPES,
  REPORT_TYPES
} from "../../config.js?v=1.1.0";
import { dateKey, daysBetween, formatDateTime, formatShortDate } from "../../domain/dates.js?v=1.1.0";
import {
  computeAccountHealth,
  computeSegmentPerformance,
  visitKey
} from "../../domain/health.js?v=1.1.0";
import { opportunityStateId } from "../../domain/identity.js?v=1.1.0";
import {
  eliteAssignmentsForAccount,
  perfectLaunchContext,
  preorderStateId
} from "../../domain/execution.js?v=1.1.0";
import { performanceMetrics } from "../../domain/reports.js?v=1.1.0";
import { resolvePriceEntry } from "../../domain/pricing.js?v=1.1.0";
import {
  accountSecondary,
  appScreen,
  badge,
  displayAccountName,
  emptyState,
  escapeHtml,
  gradeChip,
  icon,
  mediaAttachmentButtons,
  panel,
  performancePeriodControl,
  progressBar,
  screenHeader,
  segmented,
  sectionHeading
} from "../components.js?v=1.1.0";

function accountItems(collection, accountId) {
  return Object.values(collection || {})
    .filter((item) => item.accountId === accountId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function detailDisclosure(id, title, glance, body, expandedDetails) {
  return `<details class="panel detail-accordion detail-card" data-disclosure-id="${escapeHtml(id)}" ${expandedDetails?.has(id) ? "open" : ""}>
    <summary>
      <span>
        <b>${escapeHtml(title)}</b>
        <small>${escapeHtml(glance)}</small>
      </span>
      ${icon("chevron-down")}
    </summary>
    <div class="detail-card__body">${body}</div>
  </details>`;
}

function complianceDate(record) {
  return record?.completedOn || (record?.completedAt ? dateKey(record.completedAt) : "");
}

function complianceSnapshot(field, accountId) {
  const today = dateKey();
  const records = field.compliance[accountId] || {};
  const completed = COMPLIANCE_ITEMS.filter((item) => complianceDate(records[item.id]) === today).length;
  const current = COMPLIANCE_ITEMS.filter((item) => {
    const completedAt = complianceDate(records[item.id]);
    return completedAt && daysBetween(completedAt, today) <= 30;
  }).length;
  return { today, records, completed, current };
}

function complianceContent(field, accountId) {
  const { today, records, completed } = complianceSnapshot(field, accountId);
  return `<div class="panel--pad">
    <div class="progress-head">
      <h2 class="h-card">Compliance cycle</h2>
      ${badge(`${completed}/${COMPLIANCE_ITEMS.length} today`, completed === COMPLIANCE_ITEMS.length ? "done" : "open")}
    </div>
    <div style="margin:11px 0 8px">${progressBar((completed / COMPLIANCE_ITEMS.length) * 100, completed === COMPLIANCE_ITEMS.length ? "pine" : "")}</div>
  </div>
  ${COMPLIANCE_ITEMS.map((item) => {
    const doneToday = complianceDate(records[item.id]) === today;
    return `<button class="task-row ${doneToday ? "is-done" : ""}" type="button" data-action="toggle-compliance" data-account-id="${escapeHtml(accountId)}" data-compliance-id="${item.id}">
      <span class="task-row__state">${doneToday ? icon("check", 15) : ""}</span>
      <span class="task-row__body">
        <span class="task-row__title">${escapeHtml(item.label)}</span>
        <span class="task-row__detail">${records[item.id]?.completedAt ? `Last ${formatShortDate(records[item.id].completedAt)}` : "No completion recorded"}</span>
      </span>
    </button>`;
  }).join("")}`;
}

function complianceCard(field, accountId) {
  return panel(complianceContent(field, accountId));
}

function eliteCard(state, account, context) {
  const assignments = eliteAssignmentsForAccount(state.report, account.id);
  const open = assignments.filter((item) => !state.field.eliteStates[item.id]?.completedAt && normalizeEliteStatus(item.sourceStatus) !== "rejected");
  const disclosureId = `account:${account.id}:elite`;
  return `<details class="panel detail-accordion" data-disclosure-id="${escapeHtml(disclosureId)}" ${context.expandedDetails?.has(disclosureId) ? "open" : ""}>
    <summary>
      <span><b>Elite tasks</b><small>${assignments.length ? `${open.length} open of ${assignments.length}` : "No matched snapshot"}</small></span>
      ${icon("chevron-down")}
    </summary>
    <div class="compact-work-list">
      ${assignments.length ? assignments.map((item) => {
        const completed = Boolean(state.field.eliteStates[item.id]?.completedAt);
        const rejected = normalizeEliteStatus(item.sourceStatus) === "rejected";
        return `<button class="task-row ${completed ? "is-done" : ""} ${rejected ? "is-muted" : ""}" type="button" data-action="toggle-elite" data-assignment-id="${escapeHtml(item.id)}" data-account-id="${escapeHtml(account.id)}" data-title="${escapeHtml(item.title)}" data-category="${escapeHtml(item.category)}" ${rejected ? "disabled" : ""}>
          <span class="task-row__state">${completed ? icon("check", 15) : rejected ? icon("x", 15) : ""}</span>
          <span class="task-row__body">
            <span class="task-row__title">${escapeHtml(item.title)}</span>
            <span class="task-row__detail">${escapeHtml([item.category, item.dueLabel || (item.dueDate ? formatShortDate(item.dueDate) : ""), rejected ? "Rejected in Elite" : ""].filter(Boolean).join(" · "))}</span>
          </span>
        </button>`;
      }).join("") : emptyState({
        iconName: "badge-check",
        title: "No Elite assignments matched",
        message: "Import an Elite snapshot and confirm uncertain account names in Review."
      })}
    </div>
  </details>`;
}

function normalizeEliteStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function preorderCard(state, account, context) {
  const items = state.report.current.preorders?.items || [];
  const touched = items.filter((item) => {
    const status = state.field.preorderStates[preorderStateId(account.id, item.id)]?.status;
    return status && status !== "Not discussed";
  }).length;
  const disclosureId = `account:${account.id}:preorders`;
  return `<details class="panel detail-accordion" data-disclosure-id="${escapeHtml(disclosureId)}" ${context.expandedDetails?.has(disclosureId) ? "open" : ""}>
    <summary>
      <span><b>Preorders</b><small>${items.length ? `${touched}/${items.length} discussed` : "No current catalog"}</small></span>
      ${icon("chevron-down")}
    </summary>
    <div class="compact-work-list preorder-list">
      ${items.length ? items.map((item) => {
        const stateId = preorderStateId(account.id, item.id);
        const response = state.field.preorderStates[stateId] || { status: "Not discussed" };
        return `<button class="preorder-row" type="button" data-action="edit-preorder" data-account-id="${escapeHtml(account.id)}" data-item-id="${escapeHtml(item.id)}">
          <span class="preorder-row__body"><b>${escapeHtml(item.name)}</b><small>${escapeHtml([item.itemNumber ? `Item ${item.itemNumber}` : "", item.deadline ? `Due ${formatShortDate(item.deadline)}` : "", item.launchDate ? `Launch ${formatShortDate(item.launchDate)}` : ""].filter(Boolean).join(" · "))}</small></span>
          ${badge(response.status, response.status === "Ordered" ? "done" : response.status === "Declined" ? "due" : response.status === "Interested" ? "amber" : "open")}
        </button>`;
      }).join("") : emptyState({
        iconName: "package-open",
        title: "No preorder catalog",
        message: "Import the current preorder snapshot once, then record each buyer response here."
      })}
    </div>
  </details>`;
}

function todayTab(state, account, context) {
  const { field } = state;
  const today = dateKey();
  const tasks = accountItems(field.tasks, account.id).filter((task) => !task.doneAt);
  const notes = accountItems(field.notes, account.id);
  const visited = Boolean(field.visits[visitKey(account.id, today)]);

  return `<div class="account-objective panel">
      <span class="t-cap">This visit</span>
      <h2 class="h-card account-objective__text">${escapeHtml(account.objective || "Set a clear objective for this account.")}</h2>
      <button class="btn ${visited ? "btn--secondary" : "btn--primary"} btn--full account-objective__action" type="button" data-action="mark-single-visited" data-account-id="${escapeHtml(account.id)}">
        ${icon(visited ? "check" : "map-pin-check")}${visited ? "Visited today" : "Mark account visited"}
      </button>
    </div>

    ${sectionHeading("Field checklist", `<button class="btn btn--small btn--quiet" data-action="add-task" data-account-id="${escapeHtml(account.id)}">${icon("plus", 15)}Task</button>`)}
    ${complianceCard(field, account.id)}

    ${sectionHeading("Execution")}
    ${eliteCard(state, account, context)}
    ${preorderCard(state, account, context)}

    ${sectionHeading("Open tasks")}
    ${tasks.length ? panel(tasks.map((task) => `<button class="task-row ${task.dueDate && task.dueDate < today ? "is-urgent" : ""}" type="button" data-action="toggle-task" data-task-id="${escapeHtml(task.id)}">
      <span class="task-row__state"></span>
      <span class="task-row__body">
        <span class="task-row__title">${escapeHtml(task.title)}</span>
        <span class="task-row__detail">${escapeHtml(task.details || task.type)}${task.dueDate ? ` · ${formatShortDate(task.dueDate)}` : ""}</span>
      </span>
    </button>`).join("")) : panel(emptyState({
      iconName: "check-check",
      title: "No open tasks",
      message: "This account has a clear working list."
    }))}

    ${sectionHeading("Recent notes", `<button class="btn btn--small btn--quiet" data-action="select-account-tab" data-value="notes">${icon("plus", 15)}Note</button>`)}
    ${notes.length ? panel(notes.slice(0, 2).map((note) => `<div class="list-row">
      <span class="list-row__body">
        <span class="list-row__title">${escapeHtml(note.type)}</span>
        <span class="list-row__detail">${escapeHtml(note.body)}</span>
        ${mediaAttachmentButtons(note.attachments, { noteId: note.id })}
      </span>
      <span class="t-sub">${formatShortDate(note.createdAt)}</span>
    </div>`).join("")) : panel(emptyState({
      iconName: "notebook-pen",
      title: "No account memory yet",
      message: "A short note here makes the next visit easier."
    }))}`;
}

function performanceContent(report, accountId, selectedPeriod) {
  const performance = report.current.performance;
  const account = performance?.accounts?.[accountId];
  if (!account) {
    return emptyState({
      iconName: "chart-no-axes-combined",
      title: "No matched performance report",
      message: "Import a performance workbook and resolve this account in Review."
    });
  }
  const summary = account.summary;
  const metrics = performanceMetrics(performance, selectedPeriod);
  const currentKey = `${metrics.period}Current`;
  const deltaKey = `${metrics.period}Delta`;
  const summaryDelta = Number(summary[deltaKey]) || 0;
  return `<div class="panel--pad">
    ${performancePeriodControl(metrics)}
    <div class="detail-summary">
      <strong>${Number(summary[currentKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
      <span class="t-sub">${escapeHtml(metrics.valueLabel)}</span>
      <span class="delta ${summaryDelta >= 0 ? "delta--up" : "delta--down"}">${summaryDelta >= 0 ? "+" : ""}${Math.round(summaryDelta * 100)}% ${escapeHtml(metrics.comparisonLabel)}</span>
    </div>
    ${account.items.map((item) => {
      const delta = Number(item[deltaKey]) || 0;
      return `<div class="performance-row">
      <div class="performance-row__head">
        <b>${escapeHtml(item.segment)}</b>
        <span class="t-num">${Number(item[currentKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
        <span class="delta ${delta >= 0 ? "delta--up" : "delta--down"}">${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%</span>
      </div>
      ${progressBar(Math.min(100, Math.max(0, 50 + delta * 50)), delta >= 0 ? "pine" : "")}
    </div>`;
    }).join("")}
  </div>`;
}

function priceBookContent(field, accountId) {
  const prices = Object.values(field.priceBooks[accountId] || {}).map((item) => resolvePriceEntry(field, item));
  return `${prices.length ? prices.map((item) => `<button class="list-row price-book-row" type="button" data-action="edit-price" data-account-id="${escapeHtml(accountId)}" data-price-id="${escapeHtml(item.id)}">
      <span class="list-row__body">
        <span class="list-row__title">${escapeHtml(item.sku)}</span>
        <span class="list-row__detail">${item.caseCost ? `$${Number(item.caseCost).toFixed(2)} case` : "Case cost open"} · ${item.unitsPerCase || "?"} units${item.twoForEnabled && item.twoFor ? ` · 2/$${Number(item.twoFor).toFixed(2)}` : ""}</span>
      </span>
      <span class="price-row__result"><b>${item.retail ? `$${Number(item.retail).toFixed(2)}` : "—"}</b><small>${Number.isFinite(item.currentMargin) ? `${item.currentMargin.toFixed(1)}% margin` : "Add retail"}</small></span>
    </button>`).join("") : emptyState({
      iconName: "badge-dollar-sign",
      title: "No SKUs tracked",
      message: "Add only the products whose price or margin you want to watch."
    })}
    <div class="panel--pad"><button class="btn btn--secondary btn--full" type="button" data-action="add-price" data-account-id="${escapeHtml(accountId)}">${icon("plus")}Add SKU to track</button></div>`;
}

function opportunityPanels(state, account, context) {
  const { field, report } = state;
  const types = ["chainVoid", "scaleUp", "perfectLaunch"];
  return types.map((type) => {
    const matched = report.current[type]?.accounts?.[account.id];
    const open = (matched?.items || []).filter((item) => {
      const stateId = opportunityStateId(account.id, item);
      const current = field.opportunityStates[stateId] || "Open";
      return isOpenOpportunityState(current);
    }).length;
    const disclosureId = `account:${account.id}:${type}`;
    return `<details class="panel detail-accordion" data-disclosure-id="${escapeHtml(disclosureId)}" ${context.expandedDetails?.has(disclosureId) ? "open" : ""}>
      <summary>
        <span>
          <b>${escapeHtml(REPORT_TYPES[type].label)}</b>
          <small>${matched ? `${open} open of ${matched.items.length}` : "No matched report"}</small>
        </span>
        ${icon("chevron-down")}
      </summary>
      <div>
        ${matched?.items?.length ? matched.items.map((item) => {
          const stateId = opportunityStateId(account.id, item);
          const current = normalizeOpportunityState(field.opportunityStates[stateId]);
          const launchContext = type === "perfectLaunch" ? perfectLaunchContext(report, item) : null;
          return `<div class="list-row">
            <span class="list-row__body">
              <span class="list-row__title">${escapeHtml(item.name)}</span>
              <span class="list-row__detail">${escapeHtml([
                item.itemNumber ? `Item ${item.itemNumber}` : "",
                item.category || item.priority || "Opportunity",
                launchContext?.status || "",
                launchContext ? `${launchContext.voids} report voids` : ""
              ].filter(Boolean).join(" · "))}</span>
            </span>
            <button
              class="filter-control opportunity-state"
              type="button"
              data-action="cycle-opportunity"
              data-state-id="${escapeHtml(stateId)}"
              data-current="${escapeHtml(current)}"
              data-account-id="${escapeHtml(account.id)}"
              data-item-name="${escapeHtml(item.name)}"
            >${escapeHtml(current)}</button>
          </div>`;
        }).join("") : emptyState({
          iconName: "circle-dashed",
          title: "Nothing matched here",
          message: "The current report has no confirmed items for this account."
        })}
      </div>
    </details>`;
  }).join("");
}

function detailsTab(state, account, context) {
  const { field, report } = state;
  const performance = computeSegmentPerformance(report, account.id);
  const prices = Object.values(field.priceBooks[account.id] || {}).map((item) => resolvePriceEntry(field, item));
  const margins = prices.filter((item) => Number.isFinite(item.currentMargin));
  const averageMargin = margins.length
    ? margins.reduce((sum, item) => sum + item.currentMargin, 0) / margins.length
    : null;
  const infoCount = [account.buyer, account.phone, account.email, account.address].filter(Boolean).length;
  const compliance = complianceSnapshot(field, account.id);
  const performanceGlance = performance.hasData
    ? `${performance.score}/100 · ${performance.observedSegments} segments`
    : performance.matched
      ? `${performance.observedSegments}/${performance.expectedSegments} segments available`
      : "No matched report";
  const priceGlance = `${prices.length} SKU${prices.length === 1 ? "" : "s"}${averageMargin === null ? "" : ` · ${averageMargin.toFixed(1)}% average margin`}`;

  return `${detailDisclosure(`account:${account.id}:performance`, "Performance", performanceGlance, performanceContent(report, account.id, context.performancePeriod || "ytd"), context.expandedDetails)}
    ${detailDisclosure(`account:${account.id}:prices`, "Price book", priceGlance, priceBookContent(field, account.id), context.expandedDetails)}
    ${detailDisclosure(`account:${account.id}:info`, "Account information", `${infoCount}/4 contact fields · ${account.frequency || "Weekly"}`, `<div class="panel--pad">
      <div class="detail-card__action"><h2 class="h-card">Account information</h2><button class="icon-btn" type="button" data-action="edit-account" data-account-id="${escapeHtml(account.id)}" aria-label="Edit account information">${icon("pencil", 17)}</button></div>
      <div class="info-grid">
        <span><small>Buyer</small>${escapeHtml(account.buyer || "Not set")}</span>
        <span><small>Phone</small>${escapeHtml(account.phone || "Not set")}</span>
        <span><small>Email</small>${escapeHtml(account.email || "Not set")}</span>
        <span><small>Address</small>${escapeHtml(account.address || "Not set")}</span>
      </div>
    </div>`, context.expandedDetails)}
    ${detailDisclosure(`account:${account.id}:compliance`, "Compliance history", `${compliance.current}/${COMPLIANCE_ITEMS.length} current`, complianceContent(field, account.id), context.expandedDetails)}

    ${sectionHeading("Opportunity trackers")}
    ${opportunityPanels(state, account, context)}`;
}

function notesTab(state, account, context) {
  const notes = accountItems(state.field.notes, account.id);
  const attachmentCount = context.draftAttachments?.length || 0;
  return `${panel(`<form class="notes-composer" data-form="note" data-account-id="${escapeHtml(account.id)}">
      <div class="field">
        <label for="note-type">Note type</label>
        <select id="note-type" name="type">${NOTE_TYPES.map((type) => `<option>${escapeHtml(type)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label for="note-body">Account memory</label>
        <textarea id="note-body" name="body" required placeholder="What should future-you remember?"></textarea>
      </div>
      <div class="field">
        <label for="follow-date">Follow-up date</label>
        <input id="follow-date" name="followUpDate" type="date">
      </div>
      <div class="notes-composer__actions">
        <button class="icon-btn" type="button" data-action="choose-photo" aria-label="Attach photo">${icon("camera")}</button>
        <button class="icon-btn ${context.isRecording ? "is-recording" : ""}" type="button" data-action="${context.isRecording ? "stop-recording" : "record-voice"}" aria-label="${context.isRecording ? "Stop voice recording" : "Record voice memo"}">${icon(context.isRecording ? "square" : "mic")}</button>
        <button class="btn btn--primary" type="submit">Save note</button>
        <input class="sr-only" type="file" accept="image/*" capture="environment" data-input="photo">
      </div>
      ${attachmentCount ? mediaAttachmentButtons(context.draftAttachments, { draft: true }) : ""}
    </form>`)}

    ${sectionHeading("History")}
    ${notes.length ? panel(`<div class="timeline">
      ${notes.map((note) => `<div class="timeline__item">
        <span class="timeline__rail"><span class="timeline__dot"></span><span class="timeline__line"></span></span>
        <span class="timeline__body">
          <span class="timeline__head">
            <time>${formatDateTime(note.createdAt)}</time>
            <button class="icon-btn" type="button" data-action="delete-note" data-note-id="${escapeHtml(note.id)}" aria-label="Delete note">${icon("trash-2", 16)}</button>
          </span>
          <p>${escapeHtml(note.body)}</p>
          <small>${escapeHtml(note.type)}${note.attachments?.length ? ` · ${note.attachments.length} attachment${note.attachments.length === 1 ? "" : "s"}` : ""}${note.followUpDate ? ` · Follow ${formatShortDate(note.followUpDate)}` : ""}</small>
          ${mediaAttachmentButtons(note.attachments, { noteId: note.id })}
        </span>
      </div>`).join("")}
    </div>`) : panel(emptyState({
      iconName: "notebook",
      title: "No notes yet",
      message: "Keep it short, specific, and useful on the next call."
    }))}`;
}

export function renderAccount(state, context = {}) {
  const { field, report, ui } = state;
  const account = field.accounts[ui.accountId];
  if (!account) {
    return appScreen({
      route: "account",
      field,
      ambient: "canyon",
      header: screenHeader({ eyebrow: "Account", title: "Not found", back: true }),
      content: panel(emptyState({
        iconName: "user-x",
        title: "This account is unavailable",
        message: "Return to My Route and choose another stop.",
        action: "navigate",
        actionLabel: "Open My Route"
      })),
      isOnline: context.isOnline
    });
  }

  const health = computeAccountHealth({ accountId: account.id, field, report });
  const tabs = [
    { id: "today", label: "Today" },
    { id: "details", label: "Details" },
    { id: "notes", label: "Notes" }
  ];
  const tabContent = ui.accountTab === "details"
    ? detailsTab(state, account, context)
    : ui.accountTab === "notes"
      ? notesTab(state, account, context)
      : todayTab(state, account, context);

  return appScreen({
    route: "account",
    field,
    ambient: health.grade === "A" ? "pine" : health.grade === "D" || health.grade === "F" ? "canyon" : "slate",
    header: screenHeader({
      eyebrow: accountSecondary(account) || account.type,
      title: displayAccountName(account),
      subtitle: health.reasons[0],
      back: true,
      action: gradeChip(health, 44)
    }),
    controls: `<div class="account-tabs">${segmented(tabs, ui.accountTab, "select-account-tab")}</div>`,
    content: `<div class="detail-grid">${tabContent}</div>`,
    isOnline: context.isOnline
  });
}
