import { DAY_DEFS } from "../config.js?v=1.1.0";
import { gradeStyle } from "../domain/health.js?v=1.1.0";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function icon(name, size = 20) {
  return `<i data-lucide="${escapeHtml(name)}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`;
}

export function displayAccountName(account) {
  return account.nickname || account.name;
}

export function accountSecondary(account) {
  const parts = [];
  if (account.storeNumber) parts.push(`#${account.storeNumber}`);
  if (account.accountNumber) parts.push(`Acct ${account.accountNumber}`);
  if (account.town) parts.push(account.town);
  return parts.join(" · ");
}

export function gradeChip(health, size = 28) {
  const style = gradeStyle(health?.grade);
  const grade = health?.grade || "–";
  const classes = [
    "grade-chip",
    !health?.grade ? "grade-chip--none" : "",
    health?.grade === "F" ? "grade-chip--f" : ""
  ].filter(Boolean).join(" ");
  const label = health?.grade
    ? `Health grade ${health.grade}, score ${health.score}`
    : "Health has no data";
  return `<span
    class="${classes}"
    style="--grade-size:${size}px;--grade-fill:${style.fill};--grade-color:${style.color}"
    aria-label="${escapeHtml(label)}"
  >${grade}</span>`;
}

export function badge(text, tone = "open") {
  return `<span class="badge badge--${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function attachmentDetails(attachment, index) {
  if (attachment && typeof attachment === "object") {
    return {
      id: attachment.id,
      name: attachment.name || `Attachment ${index + 1}`,
      type: attachment.type || ""
    };
  }
  return {
    id: attachment,
    name: `Attachment ${index + 1}`,
    type: ""
  };
}

export function mediaAttachmentButtons(attachments = [], options = {}) {
  const items = attachments
    .map(attachmentDetails)
    .filter((attachment) => attachment.id);
  if (!items.length) return "";
  return `<div class="attachment-list">
    ${items.map((attachment) => {
      const iconName = attachment.type.startsWith("audio")
        ? "audio-lines"
        : attachment.type.startsWith("image")
          ? "image"
          : "paperclip";
      return `<button
        class="attachment-chip"
        type="button"
        data-action="open-media"
        data-media-id="${escapeHtml(attachment.id)}"
        ${options.noteId ? `data-note-id="${escapeHtml(options.noteId)}"` : ""}
        ${options.draft ? `data-draft="true"` : ""}
        aria-label="Open ${escapeHtml(attachment.name)}"
      >${icon(iconName, 15)}<span>${escapeHtml(attachment.name)}</span></button>`;
    }).join("")}
  </div>`;
}

export function segmented(items, active, action, extraClass = "") {
  return `<div class="segmented ${extraClass}" role="tablist">
    ${items.map((item) => `<button
      class="segmented__item ${item.id === active ? "is-active" : ""}"
      type="button"
      role="tab"
      aria-selected="${item.id === active}"
      data-action="${escapeHtml(action)}"
      data-value="${escapeHtml(item.id)}"
    >${escapeHtml(item.label)}</button>`).join("")}
  </div>`;
}

export function performancePeriodControl(metrics) {
  if (!metrics?.supportsPeriodToggle) {
    return `<div class="performance-period-unavailable">
      <div class="segmented segmented--surface performance-period performance-period--disabled" role="group" aria-label="Performance period unavailable">
        <button class="segmented__item" type="button" disabled>MTD</button>
        <button class="segmented__item" type="button" disabled>YTD</button>
      </div>
      <p class="performance-period__note">MTD/YTD are not included in this workbook. Showing ${escapeHtml(metrics?.valueLabel || "report totals")} ${escapeHtml(metrics?.comparisonLabel || "")}.</p>
    </div>`;
  }
  return segmented(
    [
      { id: "mtd", label: "MTD" },
      { id: "ytd", label: "YTD" }
    ],
    metrics.period,
    "select-performance-period",
    "segmented--surface performance-period"
  );
}

export function daySegments(active, action = "select-day") {
  return segmented(
    DAY_DEFS.map((day) => ({ id: day.id, label: day.short })),
    active,
    action
  );
}

export function emptyState({
  iconName = "inbox",
  title,
  message,
  action = "",
  actionLabel = ""
}) {
  return `<div class="empty-state">
    <div class="empty-state__icon">${icon(iconName, 24)}</div>
    <b>${escapeHtml(title)}</b>
    <p>${escapeHtml(message)}</p>
    ${action ? `<button class="btn btn--primary" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>` : ""}
  </div>`;
}

export function screenHeader({
  eyebrow = "Alpenglow",
  title,
  subtitle = "",
  back = false,
  action = ""
}) {
  return `<header class="screen-header ${back || action ? "screen-header--row" : ""}">
    ${back ? `<button class="icon-btn icon-btn--ambient" type="button" data-action="back" aria-label="Back">${icon("chevron-left")}</button>` : ""}
    <div class="screen-header__body">
      <p class="screen-header__eyebrow">${escapeHtml(eyebrow)}</p>
      <h1 class="screen-header__title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="screen-header__sub">${escapeHtml(subtitle)}</p>` : ""}
    </div>
    ${action}
  </header>`;
}

export function bottomNav(active) {
  const items = [
    { id: "home", label: "Home", icon: "house" },
    { id: "route", label: "Route", icon: "map-pin" },
    { id: "activity", label: "Activity", icon: "chart-no-axes-combined" },
    { id: "more", label: "More", icon: "ellipsis" }
  ];
  return `<nav class="bottom-nav" aria-label="Primary">
    ${items.map((item) => `<button
      class="bottom-nav__item ${item.id === active ? "is-active" : ""}"
      type="button"
      data-action="navigate"
      data-route="${item.id}"
      aria-current="${item.id === active ? "page" : "false"}"
    >${icon(item.icon)}<span>${item.label}</span></button>`).join("")}
  </nav>`;
}

export function resumeBar(field, currentRoute) {
  const active = field.activeRoute;
  if (!active || currentRoute === "focus") return "";
  const accountId = active.accountIds?.[active.index];
  const account = field.accounts[accountId];
  if (!account) return "";
  return `<button class="resume-bar" type="button" data-action="resume-route">
    <span class="resume-bar__dot"></span>
    <span class="resume-bar__body">
      <b>Route in progress</b>
      <span>${escapeHtml(displayAccountName(account))}</span>
    </span>
    <span class="resume-bar__cta">Resume</span>
  </button>`;
}

export function offlinePill(isOnline) {
  return isOnline ? "" : `<div class="offline-pill"><i></i>Working offline</div>`;
}

export function appScreen({
  route,
  field,
  ambient = "",
  header,
  controls = "",
  content,
  showNav = true,
  focus = false,
  isOnline = true
}) {
  return `<main class="screen screen--ambient-${escapeHtml(ambient || "alpenglow")} ${focus ? "screen--focus" : ""}" data-screen="${escapeHtml(route)}">
    <div class="ambient ${ambient ? `ambient--${ambient}` : ""}"></div>
    ${offlinePill(isOnline)}
    ${header}
    ${controls}
    <div class="screen__scroll">
      <div class="snow-sheet">${content}</div>
    </div>
    ${showNav ? bottomNav(["account", "followups", "notes-library", "route-editor", "settings", "backup", "import"].includes(route) ? "" : route) : ""}
    ${showNav ? resumeBar(field, route) : ""}
  </main>`;
}

export function progressBar(value, tone = "") {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="progress ${tone ? `progress--${tone}` : ""}" style="--progress:${clamped}%"><span></span></div>`;
}

export function sectionHeading(title, action = "") {
  return `<div class="h-section"><span>${escapeHtml(title)}</span>${action}</div>`;
}

export function panel(content, classes = "") {
  return `<section class="panel ${classes}">${content}</section>`;
}

export function dueTone(dueDate, doneAt, today) {
  if (doneAt) return "done";
  if (dueDate && dueDate < today) return "due";
  if (dueDate === today) return "amber";
  return "open";
}
