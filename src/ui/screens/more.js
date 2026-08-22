import { APP_VERSION, DAY_DEFS } from "../../config.js?v=1.1.0";
import { formatDateTime, formatShortDate } from "../../domain/dates.js?v=1.1.0";
import {
  accountSecondary,
  appScreen,
  daySegments,
  displayAccountName,
  emptyState,
  escapeHtml,
  icon,
  mediaAttachmentButtons,
  panel,
  screenHeader,
  sectionHeading
} from "../components.js?v=1.1.0";

function menuRow({ iconName, title, detail, route, action = "navigate", danger = false }) {
  return `<button class="list-row ${danger ? "danger-zone" : ""}" type="button" data-action="${escapeHtml(action)}" ${route ? `data-route="${escapeHtml(route)}"` : ""}>
    ${icon(iconName)}
    <span class="list-row__body">
      <span class="list-row__title">${escapeHtml(title)}</span>
      <span class="list-row__detail">${escapeHtml(detail)}</span>
    </span>
    ${icon("chevron-right", 17)}
  </button>`;
}

export function renderMore(state, context = {}) {
  const { field, report } = state;
  const pending = Object.values(report.review).filter((item) => item.status === "pending").length;
  const content = `${sectionHeading("Plan")}
    ${panel([
      menuRow({ iconName: "list-ordered", title: "Route editor", detail: "Weekday order, frequency, and account days", route: "route-editor" }),
      menuRow({ iconName: "notebook-tabs", title: "Structured notes", detail: "Search the full account memory", route: "notes-library" }),
      menuRow({ iconName: "file-spreadsheet", title: "Report imports", detail: pending ? `${pending} item${pending === 1 ? "" : "s"} waiting for review` : "Excel reports, snapshots, and Review", route: "import" })
    ].join(""))}

    ${sectionHeading("Keep")}
    ${panel([
      menuRow({ iconName: "archive", title: "Backup and restore", detail: "JSON or full ZIP with media", route: "backup" }),
      menuRow({ iconName: "settings-2", title: "Settings", detail: "Appearance, sample route, and storage", route: "settings" })
    ].join(""))}`;

  return appScreen({
    route: "more",
    field,
    ambient: "ink",
    header: screenHeader({
      eyebrow: "Alpenglow",
      title: "More",
      subtitle: "Shape the route and protect the journal."
    }),
    content,
    isOnline: context.isOnline
  });
}

export function renderSettings(state, context = {}) {
  const { field } = state;
  const settings = field.settings;
  const accountCount = Object.keys(field.accounts).length;
  const canImportRoster = accountCount === 0 && !settings.legacyRosterImportedAt;
  const content = `${sectionHeading("Appearance")}
    ${panel(`<div class="list-row">
      ${icon("moon")}
      <span class="list-row__body"><span class="list-row__title">Dusk mode</span><span class="list-row__detail">Deep surfaces with bright field text</span></span>
      <button class="toggle ${settings.theme === "dusk" ? "is-on" : ""}" type="button" data-action="toggle-theme" role="switch" aria-checked="${settings.theme === "dusk"}"><span class="sr-only">Toggle dusk mode</span></button>
    </div>`)}

    ${sectionHeading("Route foundation")}
    ${panel(`<div class="panel--pad">
      <h2 class="h-card">${settings.legacyRosterImportedAt ? "Legacy roster imported" : "Import Route 508 roster"}</h2>
      <p class="t-body">${settings.legacyRosterImportedAt
        ? `${accountCount} accounts were anchored to their permanent account numbers on ${formatDateTime(settings.legacyRosterImportedAt)}.`
        : canImportRoster
          ? "Choose the v0.6 JSON backup once to restore account numbers, nicknames, weekday order, and visit frequency. Notes and report data are not imported."
          : "Roster import is available only before accounts are added, which prevents an uncertain merge into field data."}</p>
      <label class="btn btn--secondary btn--full ${canImportRoster ? "" : "is-disabled"}">
        ${icon(settings.legacyRosterImportedAt ? "check" : "upload")}
        ${settings.legacyRosterImportedAt ? "Roster imported" : "Choose legacy roster"}
        <input class="sr-only" type="file" accept=".json,application/json" data-input="legacy-roster" ${canImportRoster ? "" : "disabled"}>
      </label>
    </div>`)}

    ${sectionHeading("Evaluation")}
    ${panel(`<div class="panel--pad">
      <h2 class="h-card">${settings.sampleLoaded ? "Sample route is loaded" : "Load a sample route"}</h2>
      <p class="t-body">${settings.sampleLoaded ? "Clear all data to return to the true first-open experience." : "Adds a small, clearly labeled route so you can evaluate every screen. It never loads automatically."}</p>
      <button class="btn btn--secondary btn--full" type="button" data-action="load-sample" ${settings.sampleLoaded ? "disabled" : ""}>${icon("flask-conical")}${settings.sampleLoaded ? "Sample loaded" : "Load sample route"}</button>
    </div>`)}

    ${sectionHeading("Data")}
    ${panel(`<div class="panel--pad">
      <h2 class="h-card danger-zone">Clear Alpenglow</h2>
      <p class="t-body">Removes field records, reports, snapshots, and media from this device.</p>
      <button class="btn btn--danger btn--full" type="button" data-action="clear-all-data">${icon("trash-2")}Clear all data</button>
    </div>`)}

    <p class="t-sub more-footnote">Alpenglow ${escapeHtml(APP_VERSION)}. Made by Payton Stone.</p>`;

  return appScreen({
    route: "settings",
    field,
    ambient: "slate",
    header: screenHeader({
      eyebrow: "Local preferences",
      title: "Settings",
      subtitle: "Quiet controls for the app you carry.",
      back: true
    }),
    content,
    isOnline: context.isOnline
  });
}

export function renderRouteEditor(state, context = {}) {
  const { field, ui } = state;
  const accountIds = (field.routes[ui.routeDay] || []).filter((id) => field.accounts[id]);
  const available = Object.values(field.accounts).filter((account) => !accountIds.includes(account.id));
  const content = `${panel(`<div class="panel--pad">
      ${daySegments(ui.routeDay, "select-editor-day")}
    </div>`)}

    ${sectionHeading(`${DAY_DEFS.find((day) => day.id === ui.routeDay)?.label} order`, `<button class="btn btn--small btn--quiet" type="button" data-action="add-account">${icon("plus", 15)}Account</button>`)}
    ${accountIds.length ? panel(accountIds.map((accountId, index) => {
      const account = field.accounts[accountId];
      return `<div class="route-editor-row">
        <span class="account-row__order">${index + 1}</span>
        <button class="route-editor-row__account" type="button" data-action="edit-route-account" data-account-id="${escapeHtml(accountId)}">
          <span class="list-row__body">
            <span class="list-row__title">${escapeHtml(displayAccountName(account))}</span>
            <span class="list-row__detail">${escapeHtml(accountSecondary(account))} · ${escapeHtml(account.frequency || "Weekly")}</span>
          </span>
          ${icon("pencil", 16)}
        </button>
        <button class="route-editor-row__move" type="button" data-action="move-route-account" data-account-id="${escapeHtml(accountId)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Move up">${icon("chevron-up")}</button>
        <button class="route-editor-row__move" type="button" data-action="move-route-account" data-account-id="${escapeHtml(accountId)}" data-direction="1" ${index === accountIds.length - 1 ? "disabled" : ""} aria-label="Move down">${icon("chevron-down")}</button>
        <button class="route-editor-remove" type="button" data-action="remove-route-account" data-account-id="${escapeHtml(accountId)}">Remove from ${ui.routeDay.toUpperCase()}</button>
      </div>`;
    }).join("")) : panel(emptyState({
      iconName: "calendar-plus",
      title: "No stops on this day",
      message: "Add an existing account below, or create a new account."
    }))}

    ${available.length ? `${sectionHeading("Add an existing account")}
      ${panel(`<form class="panel--pad inline-form" data-form="add-route-account">
        <label class="field" style="margin:0">
          <span class="sr-only">Account</span>
          <select name="accountId">${available.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(displayAccountName(account))}</option>`).join("")}</select>
        </label>
        <button class="btn btn--primary btn--small" type="submit">Add</button>
      </form>`)}` : ""}`;

  return appScreen({
    route: "route-editor",
    field,
    ambient: "slate",
    header: screenHeader({
      eyebrow: `${Object.keys(field.accounts).length} accounts`,
      title: "Route editor",
      subtitle: "Edit any weekday without changing today.",
      back: true
    }),
    content,
    isOnline: context.isOnline
  });
}

export function renderNotesLibrary(state, context = {}) {
  const { field, ui } = state;
  const search = ui.search.trim().toLowerCase();
  const notes = Object.values(field.notes)
    .filter((note) => {
      const account = field.accounts[note.accountId];
      return !search || [note.body, note.type, account?.name, account?.nickname]
        .some((value) => String(value || "").toLowerCase().includes(search));
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const controls = `<div class="route-controls"><label class="search-control">
    ${icon("search", 18)}
    <span class="sr-only">Search notes</span>
    <input type="search" value="${escapeHtml(ui.search)}" placeholder="Account, type, or note text" data-input="notes-search">
  </label></div>`;
  const content = notes.length ? panel(notes.map((note) => {
    const account = field.accounts[note.accountId];
    return `<article class="note-library-entry">
      <div class="note-library-entry__main">
        <button class="note-library-entry__open" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(note.accountId)}" data-tab="notes">
          <span class="list-row__body">
            <span class="list-row__title">${escapeHtml(account ? displayAccountName(account) : "Unknown account")} · ${escapeHtml(note.type)}</span>
            <span class="list-row__detail">${escapeHtml(note.body)}</span>
            <span class="t-sub">${formatShortDate(note.createdAt)}</span>
          </span>
        </button>
        <button class="icon-btn note-library-entry__delete" type="button" data-action="delete-note" data-note-id="${escapeHtml(note.id)}" aria-label="Delete note">${icon("trash-2", 16)}</button>
      </div>
      ${mediaAttachmentButtons(note.attachments, { noteId: note.id })}
    </article>`;
  }).join("")) : panel(emptyState({
    iconName: "notebook",
    title: search ? "No notes match" : "No structured notes yet",
    message: search ? "Try a different account or phrase." : "Notes saved from an account collect here."
  }));

  return appScreen({
    route: "notes-library",
    field,
    ambient: "pine",
    header: screenHeader({
      eyebrow: `${notes.length} shown`,
      title: "Structured notes",
      subtitle: "Searchable account memory.",
      back: true
    }),
    controls,
    content,
    isOnline: context.isOnline
  });
}

export function renderBackup(state, context = {}) {
  const { field, report } = state;
  const content = `${sectionHeading("Export")}
    ${panel(`<div class="panel--pad">
      <h2 class="h-card">JSON backup</h2>
      <p class="t-body">Fast and compact. Includes both state layers, but not photo or voice blobs.</p>
      <button class="btn btn--secondary btn--full" type="button" data-action="export-json">${icon("file-json")}Export JSON</button>
    </div>
    <div class="panel--pad backup-divider">
      <h2 class="h-card">Full backup</h2>
      <p class="t-body">A ZIP containing state, report snapshots, photos, voice memos, and stored import files.</p>
      <button class="btn btn--primary btn--full" type="button" data-action="export-full">${icon("archive")}Export full backup</button>
    </div>`)}

    ${sectionHeading("Restore")}
    ${panel(`<div class="panel--pad">
      <h2 class="h-card">Restore a backup</h2>
      <p class="t-body">This intentionally replaces both layers after confirmation. Report imports themselves still cannot alter field data.</p>
      <label class="btn btn--secondary btn--full">
        ${icon("upload")}Choose JSON or ZIP
        <input class="sr-only" type="file" accept=".json,.zip,application/json,application/zip" data-input="restore-backup">
      </label>
    </div>`)}

    ${sectionHeading("On this device")}
    ${panel(`<div class="panel--pad">
      <p class="t-body">${Object.keys(field.accounts).length} accounts · ${Object.keys(field.notes).length} notes · ${report.snapshots.length} report snapshots</p>
      <p class="t-sub">Last backup: ${field.settings.lastBackupAt ? formatDateTime(field.settings.lastBackupAt) : "Not recorded"}</p>
    </div>`)}`;

  return appScreen({
    route: "backup",
    field,
    ambient: "ink",
    header: screenHeader({
      eyebrow: "Device archive",
      title: "Backup",
      subtitle: "Keep the field journal portable.",
      back: true
    }),
    content,
    isOnline: context.isOnline
  });
}
