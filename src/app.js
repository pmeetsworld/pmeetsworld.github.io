import {
  ACCOUNT_TYPES,
  COMPLIANCE_ITEMS,
  DAY_DEFS,
  FREQUENCIES,
  normalizeOpportunityState,
  OPPORTUNITY_STATES,
  PREORDER_STATES
} from "./config.js?v=1.1.0";
import {
  downloadBlob,
  fullBackup,
  jsonBackup,
  readBackupFile,
  restoreIndexedData
} from "./domain/backup.js?v=1.1.0";
import {
  dateKey,
  dayDefinition,
  formatDateTime,
  formatShortDate,
  weekKey
} from "./domain/dates.js?v=1.1.0";
import {
  computeAccountHealth,
  computeRouteHealth,
  snapshotHealth,
  visitKey
} from "./domain/health.js?v=1.1.0";
import { canonicalSkuKey } from "./domain/identity.js?v=1.1.0";
import {
  getMedia,
  removeMedia,
  saveMedia,
  startVoiceCapture
} from "./domain/media.js?v=1.1.0";
import { calculatePriceMetrics, priceCatalogKey } from "./domain/pricing.js?v=1.1.0";
import { parseLegacyRosterFile } from "./domain/legacy.js?v=1.1.0";
import { parseDataFile, preorderStateId, stageDataReport } from "./domain/execution.js?v=1.1.0";
import {
  displayNameFromSource,
  parseWorkbookFile,
  relinkReviewItem,
  sourceKey,
  stageParsedReport
} from "./domain/reports.js?v=1.1.0";
import { createSampleFieldState } from "./domain/sample.js?v=1.1.0";
import { clearDatabase, putRecord } from "./state/idb.js?v=1.1.0";
import { createStore } from "./state/store.js?v=1.1.0";
import { buildDaySummary, renderActivity, renderFollowUps } from "./ui/screens/activity.js?v=1.1.0";
import { renderAccount } from "./ui/screens/account.js?v=1.1.0";
import { renderFocus } from "./ui/screens/focus.js?v=1.1.0";
import { renderHome } from "./ui/screens/home.js?v=1.1.0";
import { renderImport } from "./ui/screens/import.js?v=1.1.0";
import {
  renderBackup,
  renderMore,
  renderNotesLibrary,
  renderRouteEditor,
  renderSettings
} from "./ui/screens/more.js?v=1.1.0";
import { renderRoute } from "./ui/screens/route.js?v=1.1.0";
import { escapeHtml, icon } from "./ui/components.js?v=1.1.0";

const app = document.querySelector("#app");
const store = createStore();
const routeStack = [];
let stagedImports = [];
let draftAttachments = [];
let voiceCapture = null;
let pendingRestore = null;
let mediaPreview = null;
let toast = null;
let toastTimer = null;
let searchRestore = null;
let activityMonth = dateKey().slice(0, 7);
let routePerformanceFilter = "all";
let performancePeriod = "ytd";
let customerMoverDirection = "declines";
const expandedDetails = new Set();
const CURRENT_EXECUTION_PACK = Object.freeze([
  "data/elite-2026-08-22.json",
  "data/preorders-2026-08-22.json",
  "data/pfp-2026-08-22.json",
  "data/perfect-launch-2026-08-17.csv"
]);

function newId(prefix) {
  const token = globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${token}`;
}

function fieldActivity(draft, type, title, detail = "", accountId = null) {
  draft.activity.push({
    id: newId("activity"),
    type,
    title,
    detail,
    accountId,
    createdAt: new Date().toISOString()
  });
  if (draft.activity.length > 1000) draft.activity = draft.activity.slice(-1000);
}

function showToast(message, undoable = false, onUndo = null) {
  toast = { message, undoable, onUndo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast = null;
    render();
  }, 5500);
  render();
}

function releaseMediaPreview() {
  if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
  mediaPreview = null;
}

function cancelVoiceCapture() {
  if (!voiceCapture) return;
  voiceCapture.cancel();
  voiceCapture = null;
}

function navigate(route, values = {}, options = {}) {
  const current = store.getState().ui;
  releaseMediaPreview();
  if (route !== "account" || values.accountTab && values.accountTab !== "notes") {
    cancelVoiceCapture();
  }
  if (options.stack !== false && current.route !== route) {
    routeStack.push({
      route: current.route,
      accountId: current.accountId,
      accountTab: current.accountTab,
      importTab: current.importTab
    });
  }
  if (options.stack === false) routeStack.length = 0;
  store.mutateUi((ui) => {
    ui.route = route;
    ui.overlay = null;
    Object.assign(ui, values);
  });
}

function goBack() {
  releaseMediaPreview();
  cancelVoiceCapture();
  const prior = routeStack.pop();
  if (prior) {
    store.mutateUi((ui) => Object.assign(ui, prior, { overlay: null }));
    return;
  }
  const route = store.getState().ui.route;
  const fallback = ["settings", "backup", "route-editor", "notes-library", "import"].includes(route)
    ? "more"
    : route === "account" || route === "focus"
      ? "route"
      : "home";
  navigate(fallback, {}, { stack: false });
}

function openSheet(type, values = {}) {
  store.mutateUi((ui) => {
    ui.overlay = { type, ...values };
  });
}

function closeSheet() {
  releaseMediaPreview();
  store.mutateUi((ui) => {
    ui.overlay = null;
  });
}

function sortSheet(ui) {
  const options = [
    ["order", "Route order", "list-ordered"],
    ["notDone", "Not done first", "circle-dashed"],
    ["health", "Lowest health first", "heart-pulse"],
    ["survey", "Survey needed", "clipboard-check"],
    ["outOfCode", "Out-of-code walk needed", "scan-search"],
    ["opportunities", "Most opportunities", "trending-up"]
  ];
  return `<h2 class="bottom-sheet__title">Sort My Route</h2>
    <p class="bottom-sheet__sub">The route itself stays in its saved order.</p>
    <div class="panel">${options.map(([id, label, iconName]) => `<button class="list-row" type="button" data-action="choose-sort" data-value="${id}">
      ${icon(iconName)}
      <span class="list-row__body"><span class="list-row__title">${label}</span></span>
      ${ui.sort === id ? icon("check", 18) : ""}
    </button>`).join("")}</div>`;
}

function accountForm(field, overlay) {
  const account = overlay.accountId ? field.accounts[overlay.accountId] : null;
  const sourceName = overlay.sourceName || "";
  const suggestedName = account?.name || (sourceName ? displayNameFromSource(sourceName) : "");
  const suggestedStore = account?.storeNumber || (sourceName.match(/#\s*(\d+)/)?.[1] || "");
  const selectedFrequency = account?.frequency === "Every Other Week"
    ? "Bi-Weekly"
    : account?.frequency;
  return `<h2 class="bottom-sheet__title">${account ? "Edit account" : "Add account"}</h2>
    <p class="bottom-sheet__sub">Account number is the permanent identity. Chain store number stays separate.</p>
    <form data-form="${overlay.reviewId ? "create-review-account" : account ? "edit-account" : "add-account"}" data-account-id="${escapeHtml(account?.id || "")}" data-review-id="${escapeHtml(overlay.reviewId || "")}">
      <div class="field"><label for="account-number">Account number</label><input id="account-number" name="accountNumber" required inputmode="numeric" value="${escapeHtml(account?.accountNumber || "")}"></div>
      <div class="field"><label for="account-name">Customer name</label><input id="account-name" name="name" required value="${escapeHtml(suggestedName)}"></div>
      <div class="field"><label for="account-nickname">Nickname</label><input id="account-nickname" name="nickname" value="${escapeHtml(account?.nickname || "")}"></div>
      <div class="form-grid">
        <div class="field"><label for="account-town">Town</label><input id="account-town" name="town" value="${escapeHtml(account?.town || "")}"></div>
        <div class="field"><label for="store-number">Chain store number</label><input id="store-number" name="storeNumber" inputmode="numeric" value="${escapeHtml(suggestedStore)}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="account-type">Type</label><select id="account-type" name="type">${ACCOUNT_TYPES.map((type) => `<option ${account?.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></div>
        <div class="field"><label for="account-frequency">Frequency</label><select id="account-frequency" name="frequency">${FREQUENCIES.map((frequency) => `<option ${selectedFrequency === frequency ? "selected" : ""}>${frequency}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Route days</label><div class="chips">${DAY_DEFS.map((day) => {
        const checked = account
          ? field.routes[day.id].includes(account.id)
          : day.id === store.getState().ui.routeDay;
        return `<label class="chip"><input type="checkbox" name="routeDays" value="${day.id}" ${checked ? "checked" : ""}>${day.short}</label>`;
      }).join("")}</div></div>
      <button class="btn btn--primary btn--full" type="submit">${account ? "Save account" : "Create account"}</button>
    </form>`;
}

function taskForm(overlay) {
  return `<h2 class="bottom-sheet__title">Add task</h2>
    <p class="bottom-sheet__sub">A concrete action for this account.</p>
    <form data-form="task" data-account-id="${escapeHtml(overlay.accountId)}">
      <div class="field"><label for="task-title">Task</label><input id="task-title" name="title" required placeholder="What needs to happen?"></div>
      <div class="field"><label for="task-details">Details</label><textarea id="task-details" name="details" placeholder="Useful context"></textarea></div>
      <div class="form-grid">
        <div class="field"><label for="task-type">Type</label><select id="task-type" name="type"><option>General</option><option>Elite</option><option>Follow Up</option></select></div>
        <div class="field"><label for="task-due">Due date</label><input id="task-due" name="dueDate" type="date"></div>
      </div>
      <button class="btn btn--primary btn--full" type="submit">Add task</button>
    </form>`;
}

function preorderForm(state, overlay) {
  const item = state.report.current.preorders?.items?.find((entry) => entry.id === overlay.itemId);
  const account = state.field.accounts[overlay.accountId];
  if (!item || !account) {
    return `<h2 class="bottom-sheet__title">Preorder unavailable</h2>
      <p class="bottom-sheet__sub">The source product or account is no longer available.</p>`;
  }
  const id = preorderStateId(account.id, item.id);
  const current = state.field.preorderStates[id] || {};
  return `<h2 class="bottom-sheet__title">${escapeHtml(item.name)}</h2>
    <p class="bottom-sheet__sub">${escapeHtml(account.nickname || account.name)}${item.deadline ? ` · Deadline ${formatShortDate(item.deadline)}` : ""}</p>
    <form data-form="preorder" data-account-id="${escapeHtml(account.id)}" data-item-id="${escapeHtml(item.id)}">
      <div class="field"><label for="preorder-status">Account response</label><select id="preorder-status" name="status">${PREORDER_STATES.map((status) => `<option ${current.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></div>
      <div class="field"><label for="preorder-quantity">Quantity</label><input id="preorder-quantity" name="quantity" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(current.quantity || "")}"></div>
      <div class="field"><label for="preorder-note">Account note</label><textarea id="preorder-note" name="note" placeholder="Buyer response, timing, or next step">${escapeHtml(current.note || "")}</textarea></div>
      <button class="btn btn--primary btn--full" type="submit">Save preorder response</button>
    </form>`;
}

function metricValue(value, suffix = "") {
  return Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—";
}

function priceForm(field, overlay) {
  const accountBook = field.priceBooks[overlay.accountId] || {};
  const existing = overlay.priceId ? accountBook[overlay.priceId] : null;
  const catalogKey = existing?.catalogKey || canonicalSkuKey({ name: existing?.sku });
  const catalogItem = field.skuCatalog?.[catalogKey] || {};
  const values = {
    sku: existing?.sku || catalogItem.sku || "",
    caseCost: Number(catalogItem.caseCost ?? existing?.caseCost) || 0,
    unitsPerCase: Number(catalogItem.unitsPerCase ?? existing?.unitsPerCase) || 0,
    retail: Number(existing?.retail) || 0,
    targetMargin: Number(existing?.targetMargin) || 0,
    twoFor: Number(existing?.twoFor) || 0,
    twoForEnabled: Boolean(existing?.twoForEnabled || existing?.twoFor)
  };
  const metrics = calculatePriceMetrics(values);
  const catalog = Object.values(field.skuCatalog || {}).sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
  return `<h2 class="bottom-sheet__title">${existing ? "Update" : "Track"} a SKU</h2>
    <p class="bottom-sheet__sub">Case cost and pack size can be reused at every account. Retail stays account-specific.</p>
    <form data-form="price" data-account-id="${escapeHtml(overlay.accountId)}" data-price-id="${escapeHtml(existing?.id || "")}">
      <div class="field"><label for="price-sku">SKU</label><input id="price-sku" name="sku" required placeholder="Product and pack" list="price-sku-options" data-input="price-sku" value="${escapeHtml(values.sku)}"><datalist id="price-sku-options">${catalog.map((item) => `<option value="${escapeHtml(item.sku)}"></option>`).join("")}</datalist></div>
      <div class="form-grid">
        <div class="field"><label for="case-cost">Case cost</label><input id="case-cost" name="caseCost" type="number" min="0" step="0.01" inputmode="decimal" data-input="price-math" value="${values.caseCost || ""}"></div>
        <div class="field"><label for="case-units">Retail units per case</label><input id="case-units" name="unitsPerCase" type="number" min="1" step="1" inputmode="numeric" data-input="price-math" value="${values.unitsPerCase || ""}"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="retail-price">Account retail</label><input id="retail-price" name="retail" type="number" min="0" step="0.01" inputmode="decimal" data-input="price-math" value="${values.retail || ""}"></div>
        <div class="field"><label for="target-margin">Target margin %</label><input id="target-margin" name="targetMargin" type="number" min="0" max="99" step="0.1" inputmode="decimal" data-input="price-math" value="${values.targetMargin || ""}"></div>
      </div>
      <label class="price-option"><span><b>Use 2/$ pricing</b><small>Compare a two-unit deal against unit cost.</small></span><input name="twoForEnabled" type="checkbox" data-input="two-for-toggle" ${values.twoForEnabled ? "checked" : ""}></label>
      <div class="field price-two-for" data-two-for-field ${values.twoForEnabled ? "" : "hidden"}><label for="two-for">2/$ total</label><input id="two-for" name="twoFor" type="number" min="0" step="0.01" inputmode="decimal" data-input="price-math" value="${values.twoFor || ""}"></div>
      <div class="price-calculator" aria-live="polite">
        <span><small>Unit cost</small><b data-price-metric="unit-cost">${metrics.unitCost ? `$${metricValue(metrics.unitCost)}` : "—"}</b></span>
        <span><small>Current margin</small><b data-price-metric="current-margin">${metricValue(metrics.currentMargin, "%")}</b></span>
        <span><small>Target retail</small><b data-price-metric="target-retail">${metrics.targetRetail ? `$${metricValue(metrics.targetRetail)}` : "—"}</b></span>
        <span data-two-for-metric ${values.twoForEnabled ? "" : "hidden"}><small>2/$ margin</small><b data-price-metric="two-for-margin">${metricValue(metrics.twoForMargin, "%")}</b></span>
      </div>
      <button class="btn btn--primary btn--full" type="submit">${existing ? "Save price" : "Add to price book"}</button>
    </form>`;
}

function priceValuesFromForm(form) {
  const data = new FormData(form);
  return {
    sku: String(data.get("sku") || "").trim(),
    caseCost: Number(data.get("caseCost")) || 0,
    unitsPerCase: Number(data.get("unitsPerCase")) || 0,
    retail: Number(data.get("retail")) || 0,
    targetMargin: Number(data.get("targetMargin")) || 0,
    twoForEnabled: data.get("twoForEnabled") === "on",
    twoFor: Number(data.get("twoFor")) || 0
  };
}

function updatePriceCalculator(form) {
  const values = priceValuesFromForm(form);
  const metrics = calculatePriceMetrics(values);
  const setMetric = (name, value) => {
    const element = form.querySelector(`[data-price-metric="${name}"]`);
    if (element) element.textContent = value;
  };
  setMetric("unit-cost", metrics.unitCost ? `$${metricValue(metrics.unitCost)}` : "—");
  setMetric("current-margin", metricValue(metrics.currentMargin, "%"));
  setMetric("target-retail", metrics.targetRetail ? `$${metricValue(metrics.targetRetail)}` : "—");
  setMetric("two-for-margin", metricValue(metrics.twoForMargin, "%"));
  const twoForField = form.querySelector("[data-two-for-field]");
  const twoForMetric = form.querySelector("[data-two-for-metric]");
  if (twoForField) twoForField.hidden = !values.twoForEnabled;
  if (twoForMetric) twoForMetric.hidden = !values.twoForEnabled;
}

function applyCatalogPriceData(form, sku) {
  const catalogKey = canonicalSkuKey({ name: sku });
  const catalogItem = store.getState().field.skuCatalog?.[catalogKey];
  if (!catalogItem) return;
  const caseCost = form.elements.namedItem("caseCost");
  const unitsPerCase = form.elements.namedItem("unitsPerCase");
  if (caseCost) caseCost.value = catalogItem.caseCost || "";
  if (unitsPerCase) unitsPerCase.value = catalogItem.unitsPerCase || "";
  updatePriceCalculator(form);
}

function accountInfoForm(field, overlay) {
  const account = field.accounts[overlay.accountId];
  return `<h2 class="bottom-sheet__title">Account information</h2>
    <p class="bottom-sheet__sub">${escapeHtml(account?.nickname || account?.name || "")}</p>
    <form data-form="account-info" data-account-id="${escapeHtml(overlay.accountId)}">
      <div class="field"><label for="info-buyer">Buyer</label><input id="info-buyer" name="buyer" value="${escapeHtml(account?.buyer || "")}"></div>
      <div class="field"><label for="info-phone">Phone</label><input id="info-phone" name="phone" type="tel" value="${escapeHtml(account?.phone || "")}"></div>
      <div class="field"><label for="info-email">Email</label><input id="info-email" name="email" type="email" value="${escapeHtml(account?.email || "")}"></div>
      <div class="field"><label for="info-address">Address</label><textarea id="info-address" name="address">${escapeHtml(account?.address || "")}</textarea></div>
      <div class="field"><label for="info-objective">This week's objective</label><textarea id="info-objective" name="objective">${escapeHtml(account?.objective || "")}</textarea></div>
      <button class="btn btn--primary btn--full" type="submit">Save information</button>
    </form>`;
}

function healthDaySheet(state, overlay) {
  const key = overlay.date;
  const date = new Date(`${key}T12:00:00`);
  const dayId = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
  let health = state.field.healthLog[key];
  if (!health && DAY_DEFS.some((day) => day.id === dayId)) {
    health = computeRouteHealth({
      dayId,
      week: weekKey(date),
      field: state.field,
      report: state.report,
      asOf: key
    });
  }
  return `<h2 class="bottom-sheet__title">${formatShortDate(key)} route health</h2>
    <p class="bottom-sheet__sub">${health?.grade ? `Grade ${health.grade} · ${health.score}/100` : "No field or report signals were available."}</p>
    ${health?.reasons?.length ? `<div class="panel">${health.reasons.map((reason) => `<div class="list-row">${icon("dot")}<span class="list-row__body"><span class="list-row__title">${escapeHtml(reason)}</span></span></div>`).join("")}</div>` : ""}
    <p class="t-body">Completion is separate: ${health?.visited || 0} of ${health?.total || 0} scheduled visits were recorded.</p>`;
}

function snapshotSheet(state, overlay) {
  const snapshot = state.report.snapshots.find((item) => item.id === overlay.snapshotId);
  if (!snapshot) return `<h2 class="bottom-sheet__title">Snapshot unavailable</h2>`;
  return `<h2 class="bottom-sheet__title">${escapeHtml(snapshot.label)}</h2>
    <p class="bottom-sheet__sub">${formatDateTime(snapshot.importedAt)}</p>
    <div class="panel">
      <div class="list-row"><span class="list-row__body"><span class="list-row__title">Source file</span><span class="list-row__detail">${escapeHtml(snapshot.fileName)}</span></span></div>
      <div class="list-row"><span class="list-row__body"><span class="list-row__title">Coverage</span><span class="list-row__detail">${snapshot.accountCount ? `${snapshot.accountCount} source groups · ${snapshot.matchedCount} matched · ${snapshot.reviewCount} review` : "Global report · no account match required"}</span></span></div>
      <div class="list-row"><span class="list-row__body"><span class="list-row__title">Records</span><span class="list-row__detail">${snapshot.itemCount} imported record${snapshot.itemCount === 1 ? "" : "s"} preserved</span></span></div>
      <div class="list-row"><span class="list-row__body"><span class="list-row__title">Field fingerprint</span><span class="list-row__detail">${escapeHtml(snapshot.fieldFingerprint)}</span></span></div>
    </div>
    <p class="t-body">The full report body and route-health projection are stored offline in IndexedDB.</p>`;
}

function mediaSheet(overlay) {
  if (!mediaPreview || mediaPreview.id !== overlay.mediaId) {
    return `<h2 class="bottom-sheet__title">Attachment unavailable</h2>
      <p class="bottom-sheet__sub">This media file is not stored on this device.</p>`;
  }
  const isImage = mediaPreview.type.startsWith("image");
  const isAudio = mediaPreview.type.startsWith("audio");
  const viewer = isImage
    ? `<img src="${escapeHtml(mediaPreview.url)}" alt="${escapeHtml(mediaPreview.name)}">`
    : isAudio
      ? `<audio src="${escapeHtml(mediaPreview.url)}" controls preload="metadata">Audio playback is unavailable in this browser.</audio>`
      : `<p class="t-body">This attachment can be downloaded and opened by another app.</p>`;
  return `<h2 class="bottom-sheet__title">${escapeHtml(mediaPreview.name)}</h2>
    <p class="bottom-sheet__sub">${isImage ? "Photo attachment" : isAudio ? "Voice note" : "Offline attachment"}</p>
    <div class="media-viewer">
      ${viewer}
      <a class="btn btn--secondary btn--full" href="${escapeHtml(mediaPreview.url)}" download="${escapeHtml(mediaPreview.name)}">${icon("download")}Save attachment</a>
      <button class="btn btn--danger btn--full" type="button" data-action="delete-attachment" data-media-id="${escapeHtml(mediaPreview.id)}" ${overlay.noteId ? `data-note-id="${escapeHtml(overlay.noteId)}"` : ""} ${overlay.draft ? `data-draft="true"` : ""}>${icon("trash-2")}Delete attachment</button>
    </div>`;
}

function confirmSheet(overlay) {
  if (overlay.type === "confirm-clear") {
    return `<h2 class="bottom-sheet__title danger-zone">Clear every Alpenglow record?</h2>
      <p class="bottom-sheet__sub">This cannot be undone. Export a full backup first if anything matters.</p>
      <button class="btn btn--danger btn--full" type="button" data-action="confirm-clear-all">Clear this device</button>`;
  }
  if (overlay.type === "confirm-restore") {
    return `<h2 class="bottom-sheet__title">Restore this backup?</h2>
      <p class="bottom-sheet__sub">This intentionally replaces field and report layers, then restores archived media and snapshots.</p>
      <button class="btn btn--primary btn--full" type="button" data-action="confirm-restore">Restore backup</button>`;
  }
  return "";
}

function renderOverlay(state) {
  const overlay = state.ui.overlay;
  if (!overlay) return "";
  let content = "";
  if (overlay.type === "sort") content = sortSheet(state.ui);
  if (["add-account", "edit-account", "create-review-account"].includes(overlay.type)) content = accountForm(state.field, overlay);
  if (overlay.type === "task") content = taskForm(overlay);
  if (overlay.type === "preorder") content = preorderForm(state, overlay);
  if (overlay.type === "price") content = priceForm(state.field, overlay);
  if (overlay.type === "account-info") content = accountInfoForm(state.field, overlay);
  if (overlay.type === "health-day") content = healthDaySheet(state, overlay);
  if (overlay.type === "snapshot") content = snapshotSheet(state, overlay);
  if (overlay.type === "media") content = mediaSheet(overlay);
  if (overlay.type.startsWith("confirm-")) content = confirmSheet(overlay);
  if (!content) return "";
  return `<button class="sheet-veil" type="button" data-action="close-sheet" aria-label="Close"></button>
    <section class="bottom-sheet" role="dialog" aria-modal="true">
      <button class="bottom-sheet__close" type="button" data-action="close-sheet" aria-label="Close sheet">${icon("x", 18)}</button>
      ${content}
    </section>`;
}

function toastMarkup() {
  if (!toast) return "";
  return `<div class="toast"><span>${escapeHtml(toast.message)}</span>${toast.undoable ? `<button type="button" data-action="undo">Undo</button>` : `<button type="button" data-action="dismiss-toast">OK</button>`}</div>`;
}

function render() {
  const state = store.getState();
  const previousScreen = app.querySelector("[data-screen]")?.dataset.screen;
  const previousScroll = app.querySelector(".screen__scroll")?.scrollTop || 0;
  document.documentElement.dataset.theme = state.field.settings.theme;
  const context = {
    isOnline: navigator.onLine,
    stagedImports,
    draftAttachments: draftAttachments.filter((item) => !item.accountId || item.accountId === state.ui.accountId),
    isRecording: Boolean(voiceCapture),
    expandedDetails,
    activityMonth,
    routePerformanceFilter,
    performancePeriod,
    customerMoverDirection
  };
  const screens = {
    home: renderHome,
    route: renderRoute,
    focus: renderFocus,
    account: renderAccount,
    activity: renderActivity,
    followups: renderFollowUps,
    more: renderMore,
    settings: renderSettings,
    "route-editor": renderRouteEditor,
    "notes-library": renderNotesLibrary,
    backup: renderBackup,
    import: renderImport
  };
  const renderer = screens[state.ui.route] || renderHome;
  app.innerHTML = `<div class="app-shell">${renderer(state, context)}${renderOverlay(state)}${toastMarkup()}</div>`;
  globalThis.lucide?.createIcons({ attrs: { "stroke-width": 2 } });
  if (previousScreen === state.ui.route) {
    const scroll = app.querySelector(".screen__scroll");
    if (scroll) scroll.scrollTop = previousScroll;
  }

  if (searchRestore) {
    const input = app.querySelector(`[data-input="${searchRestore.name}"]`);
    if (input) {
      input.focus();
      input.setSelectionRange(searchRestore.position, searchRestore.position);
    }
    searchRestore = null;
  }
}

function mutateField(label, mutation, options) {
  store.mutateField(label, mutation, options);
  if (options?.undoable !== false) showToast(label, true);
}

function saveRouteHealth(draft, report, dayId, date = dateKey()) {
  draft.healthLog[date] = computeRouteHealth({
    dayId,
    week: weekKey(date),
    field: draft,
    report,
    asOf: date
  });
}

function startRoute(dayId) {
  const state = store.getState();
  const accountIds = (state.field.routes[dayId] || []).filter((id) => state.field.accounts[id]);
  if (!accountIds.length) {
    showToast("No accounts are scheduled on that day.");
    return;
  }
  const today = dateKey();
  const nextIndex = accountIds.findIndex((accountId) => !state.field.visits[visitKey(accountId, today)]);
  mutateField("Route started", (field) => {
    field.activeRoute = {
      id: newId("route"),
      dayId,
      accountIds,
      index: nextIndex < 0 ? 0 : nextIndex,
      startedAt: new Date().toISOString()
    };
    fieldActivity(field, "route", `${dayDefinition(dayId).label} route started`, `${accountIds.length} stops`);
  }, { undoable: false });
  navigate("focus");
}

function markVisited(accountId, advance) {
  const state = store.getState();
  const today = dateKey();
  let finished = false;
  mutateField("Visit recorded", (field) => {
    const key = visitKey(accountId, today);
    if (!field.visits[key]) {
      field.visits[key] = {
        id: key,
        accountId,
        date: today,
        visitedAt: new Date().toISOString()
      };
      const account = field.accounts[accountId];
      fieldActivity(field, "visit", `${account?.nickname || account?.name || "Account"} visited`, today, accountId);
    }
    if (advance && field.activeRoute) {
      if (field.activeRoute.index >= field.activeRoute.accountIds.length - 1) {
        saveRouteHealth(field, state.report, field.activeRoute.dayId, today);
        field.activeRoute = null;
        finished = true;
      } else {
        field.activeRoute.index += 1;
      }
    } else {
      const dayId = DAY_DEFS.find((day) => field.routes[day.id].includes(accountId))?.id;
      if (dayId) saveRouteHealth(field, state.report, dayId, today);
    }
  });
  if (finished) navigate("home", {}, { stack: false });
}

function parseAccountForm(form) {
  const data = new FormData(form);
  return {
    accountNumber: String(data.get("accountNumber") || "").trim(),
    name: String(data.get("name") || "").trim(),
    nickname: String(data.get("nickname") || "").trim(),
    town: String(data.get("town") || "").trim(),
    storeNumber: String(data.get("storeNumber") || "").trim(),
    type: String(data.get("type") || "Independent"),
    frequency: String(data.get("frequency") || "Weekly"),
    routeDays: data.getAll("routeDays")
  };
}

function saveAccount(values, accountId = null) {
  const state = store.getState();
  const duplicate = Object.values(state.field.accounts).find((account) => (
    account.accountNumber === values.accountNumber && account.id !== accountId
  ));
  if (duplicate) throw new Error(`Account number ${values.accountNumber} is already in use.`);
  const id = accountId || `acct_${values.accountNumber.replace(/[^a-z0-9]/gi, "_")}`;
  const now = new Date().toISOString();
  mutateField(accountId ? "Account updated" : "Account created", (field) => {
    const previous = field.accounts[id] || {};
    field.accounts[id] = {
      id,
      accountNumber: values.accountNumber,
      name: values.name,
      nickname: values.nickname,
      town: values.town,
      storeNumber: values.storeNumber,
      type: values.type,
      tags: previous.tags || [],
      frequency: values.frequency,
      buyer: previous.buyer || "",
      phone: previous.phone || "",
      email: previous.email || "",
      address: previous.address || "",
      objective: previous.objective || "",
      createdAt: previous.createdAt || now,
      updatedAt: now
    };
    for (const day of DAY_DEFS) {
      const route = field.routes[day.id];
      const isAssigned = route.includes(id);
      const shouldBeAssigned = values.routeDays.includes(day.id);
      if (shouldBeAssigned && !isAssigned) route.push(id);
      if (!shouldBeAssigned && isAssigned) {
        field.routes[day.id] = route.filter((value) => value !== id);
      }
    }
    fieldActivity(field, "account", `${values.name} ${accountId ? "updated" : "created"}`, values.accountNumber, id);
  });
  return id;
}

async function commitImports() {
  const valid = stagedImports.filter((item) => !item.error);
  if (!valid.length) return;
  const state = store.getState();
  const fieldFingerprint = store.getFieldFingerprint();
  await store.commitReportImport("Reports imported", async (report) => {
    for (const stage of valid) {
      for (const [id, review] of Object.entries(report.review)) {
        if (review.reportType === stage.type) delete report.review[id];
      }
      report.current[stage.type] = stage.report;
      for (const review of stage.reviews) report.review[review.id] = review;

      const importedAt = new Date().toISOString();
      const snapshotId = newId("snapshot");
      const health = snapshotHealth(state.field, report, importedAt);
      const metadata = {
        id: snapshotId,
        type: stage.type,
        label: stage.report.label,
        fileName: stage.fileName,
        importedAt,
        accountCount: stage.report.accountCount,
        matchedCount: stage.report.matchedCount,
        reviewCount: stage.report.reviewCount,
        itemCount: stage.report.itemCount,
        fieldFingerprint,
        health
      };
      report.snapshots.push(metadata);
      await putRecord("snapshots", {
        id: snapshotId,
        metadata,
        report: stage.report,
        reviews: stage.reviews,
        health
      });
      if (stage.file) {
        await putRecord("importFiles", {
          id: newId("import"),
          reportType: stage.type,
          name: stage.file.name,
          type: stage.file.type,
          size: stage.file.size,
          importedAt,
          blob: stage.file
        });
      }
    }
    report.lastImportAt = new Date().toISOString();
  });
  stagedImports = [];
  const pending = Object.values(store.getState().report.review).some((item) => item.status === "pending");
  store.mutateUi((ui) => {
    ui.importTab = pending ? "review" : "history";
  });
  showToast("Report layer replaced. Field data fingerprint stayed unchanged.");
}

async function stageCurrentExecutionPack() {
  stagedImports = [];
  render();
  for (const path of CURRENT_EXECUTION_PACK) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Bundled source unavailable (${response.status}).`);
      const blob = await response.blob();
      const name = path.split("/").at(-1);
      const file = new File([blob], name, { type: blob.type });
      const parsed = await parseDataFile(file);
      const stage = stageDataReport(parsed, store.getState().field, store.getState().report);
      stagedImports.push({ ...stage, fileName: file.name, file });
    } catch (error) {
      stagedImports.push({ fileName: path.split("/").at(-1), error: error.message });
    }
    render();
  }
}

async function exportJson() {
  const blob = new Blob([jsonBackup(store.getState())], { type: "application/json" });
  downloadBlob(blob, `alpenglow-${dateKey()}.json`);
  store.mutateField("Backup time recorded", (field) => {
    field.settings.lastBackupAt = new Date().toISOString();
  }, { undoable: false });
  showToast("JSON backup downloaded.");
}

async function exportFull() {
  const blob = await fullBackup(store.getState());
  downloadBlob(blob, `alpenglow-full-${dateKey()}.zip`);
  store.mutateField("Backup time recorded", (field) => {
    field.settings.lastBackupAt = new Date().toISOString();
  }, { undoable: false });
  showToast("Full offline backup downloaded.");
}

async function resolveReview(reviewId, accountId) {
  if (!accountId) {
    showToast("Choose the account you are confirming.");
    return;
  }
  await store.commitReportImport("Review link confirmed", (report) => {
    const anchor = report.review[reviewId];
    if (!anchor) return;
    const key = sourceKey(anchor.sourceName);
    const matches = Object.values(report.review).filter((review) => (
      review.status === "pending" && sourceKey(review.sourceName) === key
    ));
    for (const review of matches) {
      const linked = relinkReviewItem(review, accountId);
      const current = report.current[review.reportType];
      if (current) {
        current.accounts[accountId] = linked;
        current.matchedCount = Object.keys(current.accounts).length;
        current.reviewCount = Math.max(0, current.reviewCount - 1);
      }
      review.status = "linked";
      review.accountId = accountId;
      review.resolvedAt = new Date().toISOString();
    }
    report.links[key] = accountId;
  });
  showToast("Account link confirmed across current and future reports.");
}

function attachmentId(attachment) {
  return attachment && typeof attachment === "object" ? attachment.id : attachment;
}

async function openMediaAttachment(mediaId, context = {}) {
  const record = await getMedia(mediaId);
  if (!record?.blob) throw new Error("This attachment is not stored on this device.");
  releaseMediaPreview();
  mediaPreview = {
    id: record.id,
    name: record.name || "Attachment",
    type: record.type || record.blob.type || "application/octet-stream",
    url: URL.createObjectURL(record.blob)
  };
  openSheet("media", { mediaId: record.id, ...context });
}

function scheduleUnusedMediaCleanup(attachments) {
  const ids = attachments.map(attachmentId).filter(Boolean);
  if (!ids.length) return;
  setTimeout(async () => {
    const referenced = new Set(
      [
        ...Object.values(store.getState().field.notes)
          .flatMap((note) => (note.attachments || []).map(attachmentId)),
        ...draftAttachments.map(attachmentId)
      ].filter(Boolean)
    );
    await Promise.all(ids.filter((id) => !referenced.has(id)).map(removeMedia));
  }, 6000);
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  try {
    if (action === "navigate") {
      navigate(target.dataset.route || "route-editor", {}, { stack: !["home", "route", "activity", "more"].includes(target.dataset.route) });
    } else if (action === "back") {
      goBack();
    } else if (action === "close-sheet") {
      closeSheet();
    } else if (action === "select-day" || action === "select-editor-day") {
      store.mutateUi((ui) => { ui.routeDay = target.dataset.value; });
    } else if (action === "select-performance-filter") {
      routePerformanceFilter = target.dataset.value || "all";
      render();
    } else if (action === "select-performance-period") {
      performancePeriod = target.dataset.value === "mtd" ? "mtd" : "ytd";
      render();
    } else if (action === "select-customer-mover-direction") {
      customerMoverDirection = target.dataset.value === "gains" ? "gains" : "declines";
      render();
    } else if (action === "open-sort") {
      openSheet("sort");
    } else if (action === "choose-sort") {
      store.mutateUi((ui) => { ui.sort = target.dataset.value; ui.overlay = null; });
    } else if (action === "clear-search") {
      store.mutateUi((ui) => { ui.search = ""; });
    } else if (action === "start-route") {
      startRoute(target.dataset.day || store.getState().ui.routeDay);
    } else if (action === "resume-route") {
      navigate("focus");
    } else if (action === "open-account") {
      navigate("account", { accountId: target.dataset.accountId, accountTab: "today" });
    } else if (action === "open-account-tab") {
      navigate("account", { accountId: target.dataset.accountId, accountTab: target.dataset.tab || "today" });
    } else if (action === "select-account-tab") {
      if (target.dataset.value !== "notes") cancelVoiceCapture();
      store.mutateUi((ui) => { ui.accountTab = target.dataset.value; });
    } else if (action === "toggle-task") {
      const taskId = target.dataset.taskId;
      mutateField("Task updated", (field) => {
        const task = field.tasks[taskId];
        if (!task) return;
        task.doneAt = task.doneAt ? null : new Date().toISOString();
        const account = field.accounts[task.accountId];
        fieldActivity(field, "task", task.doneAt ? `${task.title} completed` : `${task.title} reopened`, account?.name || "", task.accountId);
      });
    } else if (action === "toggle-elite") {
      const assignmentId = target.dataset.assignmentId;
      mutateField("Elite task updated", (field) => {
        const current = field.eliteStates[assignmentId] || {};
        const completedAt = current.completedAt ? null : new Date().toISOString();
        field.eliteStates[assignmentId] = { ...current, completedAt, updatedAt: new Date().toISOString() };
        fieldActivity(
          field,
          "elite",
          `${target.dataset.title || "Elite task"} ${completedAt ? "completed" : "reopened"}`,
          target.dataset.category || "Elite",
          target.dataset.accountId || null
        );
      });
    } else if (action === "edit-preorder") {
      openSheet("preorder", { accountId: target.dataset.accountId, itemId: target.dataset.itemId });
    } else if (action === "toggle-compliance") {
      const accountId = target.dataset.accountId;
      const itemId = target.dataset.complianceId;
      mutateField("Compliance updated", (field) => {
        field.compliance[accountId] ||= {};
        const existing = field.compliance[accountId][itemId];
        const today = dateKey();
        const completedOn = existing?.completedOn || (existing?.completedAt ? dateKey(existing.completedAt) : null);
        const doneToday = completedOn === today;
        field.compliance[accountId][itemId] = doneToday
          ? { completedAt: null, completedOn: null }
          : { completedAt: new Date().toISOString(), completedOn: today };
        const label = COMPLIANCE_ITEMS.find((item) => item.id === itemId)?.label || "Compliance";
        fieldActivity(field, "compliance", `${label} ${doneToday ? "cleared" : "completed"}`, field.accounts[accountId]?.name || "", accountId);
      });
    } else if (action === "mark-visited") {
      markVisited(target.dataset.accountId, true);
    } else if (action === "mark-single-visited") {
      markVisited(target.dataset.accountId, false);
    } else if (action === "skip-stop") {
      mutateField("Stop skipped for now", (field) => {
        if (!field.activeRoute) return;
        field.activeRoute.index = (field.activeRoute.index + 1) % field.activeRoute.accountIds.length;
      });
    } else if (action === "exit-focus") {
      mutateField("Focus mode ended", (field) => { field.activeRoute = null; }, { undoable: false });
      navigate("route", {}, { stack: false });
    } else if (action === "add-account") {
      openSheet("add-account");
    } else if (action === "edit-account") {
      openSheet("account-info", { accountId: target.dataset.accountId });
    } else if (action === "edit-route-account") {
      openSheet("edit-account", { accountId: target.dataset.accountId });
    } else if (action === "add-task") {
      openSheet("task", { accountId: target.dataset.accountId });
    } else if (action === "add-price") {
      openSheet("price", { accountId: target.dataset.accountId });
    } else if (action === "edit-price") {
      openSheet("price", { accountId: target.dataset.accountId, priceId: target.dataset.priceId });
    } else if (action === "move-route-account") {
      const accountId = target.dataset.accountId;
      const direction = Number(target.dataset.direction);
      const dayId = store.getState().ui.routeDay;
      mutateField("Route order updated", (field) => {
        const route = field.routes[dayId];
        const index = route.indexOf(accountId);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= route.length) return;
        [route[index], route[next]] = [route[next], route[index]];
      });
    } else if (action === "remove-route-account") {
      const accountId = target.dataset.accountId;
      const dayId = store.getState().ui.routeDay;
      mutateField("Account removed from route day", (field) => {
        field.routes[dayId] = field.routes[dayId].filter((id) => id !== accountId);
      });
    } else if (action === "toggle-theme") {
      mutateField("Appearance updated", (field) => {
        field.settings.theme = field.settings.theme === "dusk" ? "light" : "dusk";
      });
    } else if (action === "load-sample") {
      if (Object.keys(store.getState().field.accounts).length) {
        showToast("Sample data can only load into an empty app.");
      } else {
        store.replaceField(createSampleFieldState(), "Sample route loaded");
        showToast("Sample route loaded. It is clearly marked in Settings.");
        navigate("home", {}, { stack: false });
      }
    } else if (action === "clear-all-data") {
      openSheet("confirm-clear");
    } else if (action === "confirm-clear-all") {
      await clearDatabase();
      store.resetAll();
      stagedImports = [];
      draftAttachments = [];
      pendingRestore = null;
      routeStack.length = 0;
      expandedDetails.clear();
      showToast("Alpenglow returned to a clean first open.");
    } else if (action === "cycle-opportunity") {
      const id = target.dataset.stateId;
      const current = normalizeOpportunityState(target.dataset.current);
      const next = OPPORTUNITY_STATES[(OPPORTUNITY_STATES.indexOf(current) + 1) % OPPORTUNITY_STATES.length];
      mutateField("Opportunity state updated", (field) => {
        field.opportunityStates[id] = next;
        fieldActivity(
          field,
          "opportunity",
          target.dataset.itemName || "Opportunity status changed",
          next,
          target.dataset.accountId || null
        );
      });
    } else if (action === "open-media") {
      await openMediaAttachment(target.dataset.mediaId, {
        noteId: target.dataset.noteId || null,
        draft: target.dataset.draft === "true"
      });
    } else if (action === "delete-attachment") {
      const mediaId = target.dataset.mediaId;
      if (target.dataset.draft === "true") {
        const index = draftAttachments.findIndex((item) => attachmentId(item) === mediaId);
        if (index < 0) return;
        const [removed] = draftAttachments.splice(index, 1);
        closeSheet();
        scheduleUnusedMediaCleanup([removed]);
        showToast("Draft attachment removed", true, () => {
          if (!draftAttachments.some((item) => attachmentId(item) === mediaId)) draftAttachments.push(removed);
        });
      } else {
        const noteId = target.dataset.noteId;
        const note = store.getState().field.notes[noteId];
        const attachment = note?.attachments?.find((item) => attachmentId(item) === mediaId);
        if (!note || !attachment) return;
        mutateField("Attachment removed", (field) => {
          const savedNote = field.notes[noteId];
          savedNote.attachments = (savedNote.attachments || []).filter((item) => attachmentId(item) !== mediaId);
          fieldActivity(field, "note", "Attachment removed from structured note", savedNote.type, savedNote.accountId);
        });
        closeSheet();
        scheduleUnusedMediaCleanup([attachment]);
      }
    } else if (action === "delete-note") {
      const noteId = target.dataset.noteId;
      const note = store.getState().field.notes[noteId];
      if (!note) return;
      const attachments = [...(note.attachments || [])];
      mutateField("Note deleted", (field) => {
        const removed = field.notes[noteId];
        if (!removed) return;
        delete field.notes[noteId];
        for (const [followUpId, followUp] of Object.entries(field.followUps)) {
          if (followUp.noteId === noteId) delete field.followUps[followUpId];
        }
        fieldActivity(field, "note", "Structured note deleted", removed.type, removed.accountId);
      });
      scheduleUnusedMediaCleanup(attachments);
    } else if (action === "choose-photo") {
      target.closest("form")?.querySelector('[data-input="photo"]')?.click();
    } else if (action === "record-voice") {
      if (voiceCapture) return;
      voiceCapture = await startVoiceCapture();
      render();
    } else if (action === "stop-recording") {
      if (!voiceCapture) return;
      const capture = voiceCapture;
      voiceCapture = null;
      render();
      const blob = await capture.stop();
      const attachment = await saveMedia(blob, {
        type: blob.type,
        name: `Voice memo ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        accountId: store.getState().ui.accountId
      });
      draftAttachments.push(attachment);
      render();
    } else if (action === "copy-summary") {
      await navigator.clipboard.writeText(buildDaySummary(store.getState().field));
      showToast("End-of-day summary copied.");
    } else if (action === "open-health-day") {
      openSheet("health-day", { date: target.dataset.date });
    } else if (action === "complete-followup") {
      mutateField("Follow-up completed", (field) => {
        const item = field.followUps[target.dataset.followupId];
        if (!item) return;
        item.doneAt = new Date().toISOString();
        fieldActivity(field, "followup", `${item.title} completed`, "", item.accountId);
      });
    } else if (action === "select-import-tab") {
      store.mutateUi((ui) => { ui.importTab = target.dataset.value; });
    } else if (action === "commit-imports") {
      await commitImports();
    } else if (action === "stage-execution-pack") {
      await stageCurrentExecutionPack();
    } else if (action === "link-review") {
      const select = app.querySelector(`[data-review-select="${CSS.escape(target.dataset.reviewId)}"]`);
      await resolveReview(target.dataset.reviewId, select?.value);
    } else if (action === "create-review-account") {
      const review = store.getState().report.review[target.dataset.reviewId];
      openSheet("create-review-account", { reviewId: target.dataset.reviewId, sourceName: review?.sourceName || "" });
    } else if (action === "exclude-review") {
      await store.commitReportImport("Review item explicitly excluded", (report) => {
        const review = report.review[target.dataset.reviewId];
        if (!review) return;
        review.status = "excluded";
        review.resolvedAt = new Date().toISOString();
        report.exclusions[sourceKey(review.sourceName)] = {
          reportType: review.reportType,
          excludedAt: review.resolvedAt
        };
        if (report.current[review.reportType]) {
          report.current[review.reportType].reviewCount = Math.max(0, report.current[review.reportType].reviewCount - 1);
        }
      });
      showToast("Source group explicitly excluded. No row was silently dropped.");
    } else if (action === "open-snapshot") {
      openSheet("snapshot", { snapshotId: target.dataset.snapshotId });
    } else if (action === "export-json") {
      await exportJson();
    } else if (action === "export-full") {
      await exportFull();
    } else if (action === "confirm-restore") {
      if (!pendingRestore) return;
      store.replaceField(pendingRestore.envelope.field);
      store.replaceReport(pendingRestore.envelope.report);
      await restoreIndexedData(pendingRestore);
      pendingRestore = null;
      closeSheet();
      showToast("Backup restored.");
      navigate("home", {}, { stack: false });
    } else if (action === "undo") {
      const customUndo = toast?.onUndo;
      if (customUndo) {
        customUndo();
        showToast("Attachment restored.");
      } else if (store.undo()) showToast("Last field change undone.");
      else showToast("Nothing left to undo.");
    } else if (action === "dismiss-toast") {
      toast = null;
      render();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "That action could not be completed.");
  }
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  try {
    const kind = form.dataset.form;
    if (["add-account", "edit-account", "create-review-account"].includes(kind)) {
      const values = parseAccountForm(form);
      const id = saveAccount(values, form.dataset.accountId || null);
      if (kind === "create-review-account") await resolveReview(form.dataset.reviewId, id);
      closeSheet();
    } else if (kind === "account-info") {
      const data = new FormData(form);
      const accountId = form.dataset.accountId;
      mutateField("Account information updated", (field) => {
        const account = field.accounts[accountId];
        for (const key of ["buyer", "phone", "email", "address", "objective"]) {
          account[key] = String(data.get(key) || "").trim();
        }
        account.updatedAt = new Date().toISOString();
        fieldActivity(field, "account", `${account.nickname || account.name} information updated`, "", accountId);
      });
      closeSheet();
    } else if (kind === "task") {
      const data = new FormData(form);
      const accountId = form.dataset.accountId;
      mutateField("Task added", (field) => {
        const id = newId("task");
        field.tasks[id] = {
          id,
          accountId,
          title: String(data.get("title") || "").trim(),
          details: String(data.get("details") || "").trim(),
          type: String(data.get("type") || "General"),
          dueDate: String(data.get("dueDate") || ""),
          doneAt: null,
          createdAt: new Date().toISOString()
        };
        fieldActivity(field, "task", `${field.tasks[id].title} added`, field.accounts[accountId]?.name || "", accountId);
      });
      closeSheet();
    } else if (kind === "preorder") {
      const data = new FormData(form);
      const accountId = form.dataset.accountId;
      const itemId = form.dataset.itemId;
      const id = preorderStateId(accountId, itemId);
      const status = String(data.get("status") || "Not discussed");
      mutateField("Preorder response updated", (field) => {
        field.preorderStates[id] = {
          status,
          quantity: Number(data.get("quantity")) || 0,
          note: String(data.get("note") || "").trim(),
          updatedAt: new Date().toISOString()
        };
        const product = store.getState().report.current.preorders?.items?.find((item) => item.id === itemId);
        fieldActivity(field, "preorder", `${product?.name || "Preorder"}: ${status}`, field.accounts[accountId]?.name || "", accountId);
      });
      closeSheet();
    } else if (kind === "price") {
      const accountId = form.dataset.accountId;
      const existingId = form.dataset.priceId;
      const values = priceValuesFromForm(form);
      const catalogKey = canonicalSkuKey({ name: values.sku });
      const metrics = calculatePriceMetrics(values);
      mutateField("Price book updated", (field) => {
        const updatedAt = new Date().toISOString();
        field.skuCatalog ||= {};
        field.skuCatalog[catalogKey] = {
          id: catalogKey,
          sku: values.sku,
          caseCost: values.caseCost,
          unitsPerCase: values.unitsPerCase,
          updatedAt
        };
        for (const book of Object.values(field.priceBooks)) {
          for (const item of Object.values(book || {})) {
            const itemKey = priceCatalogKey(item);
            if (itemKey !== catalogKey) continue;
            const recalculated = calculatePriceMetrics({
              ...item,
              caseCost: values.caseCost,
              unitsPerCase: values.unitsPerCase
            });
            Object.assign(item, {
              catalogKey,
              caseCost: values.caseCost,
              unitsPerCase: values.unitsPerCase,
              ...recalculated,
              updatedAt
            });
          }
        }
        field.priceBooks[accountId] ||= {};
        const matching = Object.values(field.priceBooks[accountId]).find((item) =>
          priceCatalogKey(item) === catalogKey
        );
        const id = existingId || matching?.id || newId("price");
        field.priceBooks[accountId][id] = {
          ...(field.priceBooks[accountId][id] || {}),
          id,
          catalogKey,
          ...values,
          ...metrics,
          updatedAt
        };
        fieldActivity(field, "pricing", `${values.sku} ${existingId || matching ? "updated" : "added to price book"}`, metrics.currentMargin === null ? "" : `${metrics.currentMargin.toFixed(1)}% current margin`, accountId);
      });
      closeSheet();
    } else if (kind === "add-route-account") {
      const accountId = String(new FormData(form).get("accountId") || "");
      const dayId = store.getState().ui.routeDay;
      mutateField("Account added to route day", (field) => {
        if (accountId && !field.routes[dayId].includes(accountId)) field.routes[dayId].push(accountId);
      });
    } else if (kind === "note") {
      const data = new FormData(form);
      const accountId = form.dataset.accountId;
      const followUpDate = String(data.get("followUpDate") || "");
      const noteAttachments = draftAttachments.filter((item) => !item.accountId || item.accountId === accountId);
      mutateField("Structured note saved", (field) => {
        const id = newId("note");
        const body = String(data.get("body") || "").trim();
        field.notes[id] = {
          id,
          accountId,
          type: String(data.get("type") || "General"),
          body,
          followUpDate,
          attachments: noteAttachments.map((item) => ({
            id: item.id,
            type: item.type,
            name: item.name
          })),
          createdAt: new Date().toISOString()
        };
        if (followUpDate) {
          const followId = newId("follow");
          field.followUps[followId] = {
            id: followId,
            accountId,
            noteId: id,
            title: body.length > 70 ? `${body.slice(0, 67)}...` : body,
            dueDate: followUpDate,
            doneAt: null,
            createdAt: field.notes[id].createdAt
          };
        }
        fieldActivity(field, "note", `${field.notes[id].type} note saved`, body, accountId);
      });
      const usedIds = new Set(noteAttachments.map((item) => item.id));
      draftAttachments = draftAttachments.filter((item) => !usedIds.has(item.id));
      form.reset();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "That form could not be saved.");
  }
});

app.addEventListener("input", (event) => {
  const input = event.target;
  if (input.matches('[data-input="route-search"], [data-input="notes-search"]')) {
    searchRestore = { name: input.dataset.input, position: input.selectionStart || input.value.length };
    store.mutateUi((ui) => { ui.search = input.value; });
  } else if (input.matches('[data-input="price-sku"]')) {
    const form = input.closest('[data-form="price"]');
    if (form) applyCatalogPriceData(form, input.value);
  } else if (input.matches('[data-input="price-math"], [data-input="two-for-toggle"]')) {
    const form = input.closest('[data-form="price"]');
    if (form) updatePriceCalculator(form);
  }
});

app.addEventListener("change", async (event) => {
  const input = event.target;
  try {
    if (input.matches('[data-input="day-note"]')) {
      mutateField("Day note updated", (field) => {
        field.dayNotes[dateKey()] = input.value.trim();
      });
    } else if (input.matches('[data-input="health-month"]')) {
      activityMonth = input.value || dateKey().slice(0, 7);
      render();
    } else if (input.matches('[data-input="photo"]') && input.files?.[0]) {
      const file = input.files[0];
      const attachment = await saveMedia(file, {
        type: file.type,
        name: file.name,
        accountId: store.getState().ui.accountId
      });
      draftAttachments.push(attachment);
      render();
    } else if (input.matches('[data-input="report-files"]')) {
      stagedImports = [];
      render();
      for (const file of input.files || []) {
        try {
          const extension = String(file.name || "").split(".").pop()?.toLowerCase();
          const isWorkbook = extension === "xlsx" || extension === "xls";
          const parsed = isWorkbook ? await parseWorkbookFile(file) : await parseDataFile(file);
          const stage = isWorkbook
            ? stageParsedReport(parsed, store.getState().field, store.getState().report)
            : stageDataReport(parsed, store.getState().field, store.getState().report);
          stagedImports.push({ ...stage, fileName: file.name, file });
        } catch (error) {
          stagedImports.push({ fileName: file.name, error: error.message });
        }
        render();
      }
    } else if (input.matches('[data-input="legacy-roster"]') && input.files?.[0]) {
      if (Object.keys(store.getState().field.accounts).length) {
        throw new Error("Legacy roster import is only available before accounts are added.");
      }
      const roster = await parseLegacyRosterFile(input.files[0]);
      mutateField(`Imported ${roster.accountCount} legacy accounts`, (field) => {
        field.accounts = roster.accounts;
        field.routes = roster.routes;
        field.settings.legacyRosterImportedAt = roster.importedAt;
        field.settings.legacyRosterSource = input.files[0].name;
        fieldActivity(
          field,
          "account",
          `${roster.accountCount} legacy accounts imported`,
          "Account-number identity and weekday order restored"
        );
      });
    } else if (input.matches('[data-input="restore-backup"]') && input.files?.[0]) {
      pendingRestore = await readBackupFile(input.files[0]);
      openSheet("confirm-restore");
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "That file could not be read.");
  }
});

app.addEventListener("toggle", (event) => {
  const disclosure = event.target.closest?.("details[data-disclosure-id]");
  if (!disclosure) return;
  if (disclosure.open) expandedDetails.add(disclosure.dataset.disclosureId);
  else expandedDetails.delete(disclosure.dataset.disclosureId);
}, true);

store.subscribe(render);

window.addEventListener("online", render);
window.addEventListener("offline", render);

render();
