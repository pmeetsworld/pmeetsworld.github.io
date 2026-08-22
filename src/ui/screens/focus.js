import { dateKey } from "../../domain/dates.js?v=1.1.0";
import { computeAccountHealth, visitKey } from "../../domain/health.js?v=1.1.0";
import {
  appScreen,
  badge,
  displayAccountName,
  emptyState,
  escapeHtml,
  gradeChip,
  icon,
  panel,
  progressBar,
  screenHeader
} from "../components.js?v=1.1.0";

export function renderFocus(state, context = {}) {
  const { field, report } = state;
  const active = field.activeRoute;
  if (!active?.accountIds?.length) {
    return appScreen({
      route: "focus",
      field,
      focus: true,
      showNav: false,
      ambient: "slate",
      header: screenHeader({ eyebrow: "Focus mode", title: "No active route", back: true }),
      content: panel(emptyState({
        iconName: "navigation-off",
        title: "Route focus is paused",
        message: "Start a weekday route from Home or My Route.",
        action: "navigate",
        actionLabel: "Open My Route"
      })),
      isOnline: context.isOnline
    });
  }

  const accountId = active.accountIds[active.index];
  const account = field.accounts[accountId];
  if (!account) {
    return appScreen({
      route: "focus",
      field,
      focus: true,
      showNav: false,
      ambient: "canyon",
      header: screenHeader({ eyebrow: "Focus mode", title: "Stop unavailable", back: true }),
      content: panel(emptyState({
        iconName: "triangle-alert",
        title: "This route stop no longer exists",
        message: "Exit focus mode and review the route order.",
        action: "exit-focus",
        actionLabel: "Exit focus"
      })),
      isOnline: context.isOnline
    });
  }

  const today = dateKey();
  const tasks = Object.values(field.tasks).filter((task) => task.accountId === accountId && !task.doneAt);
  const health = computeAccountHealth({ accountId, field, report, asOf: today });
  const progress = Math.round((active.index / active.accountIds.length) * 100);
  const alreadyVisited = Boolean(field.visits[visitKey(accountId, today)]);

  const content = `${panel(`<button class="focus-card__identity" type="button" data-action="open-account" data-account-id="${escapeHtml(accountId)}">
      <div class="focus-card__title">
        <h2>${escapeHtml(displayAccountName(account))}</h2>
        ${gradeChip(health, 38)}
      </div>
      <p class="t-sub">${escapeHtml(account.town || "Town not set")}${account.accountNumber ? ` · Acct ${escapeHtml(account.accountNumber)}` : ""}</p>
      <span class="account-memory">${escapeHtml(account.objective || health.reasons[0] || "No account memory yet.")}</span>
    </button>
    <div class="panel--pad">
      <div class="focus-links">
        <button class="btn btn--quiet" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(accountId)}" data-tab="today">Today</button>
        <button class="btn btn--quiet" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(accountId)}" data-tab="details">Details</button>
        <button class="btn btn--quiet" type="button" data-action="open-account-tab" data-account-id="${escapeHtml(accountId)}" data-tab="notes">Note</button>
      </div>
    </div>`, "focus-card")}

    ${tasks.length ? `<div class="h-section"><span>At this stop</span>${badge(`${tasks.length} open`, tasks.some((task) => task.dueDate < today) ? "due" : "open")}</div>
      ${panel(tasks.slice(0, 4).map((task) => `<button class="task-row ${task.dueDate < today ? "is-urgent" : ""}" type="button" data-action="toggle-task" data-task-id="${escapeHtml(task.id)}">
        <span class="task-row__state"></span>
        <span class="task-row__body">
          <span class="task-row__title">${escapeHtml(task.title)}</span>
          <span class="task-row__detail">${escapeHtml(task.details || task.type)}</span>
        </span>
      </button>`).join(""))}` : ""}

    <div class="focus-actions">
      <button class="btn btn--primary btn--full" type="button" data-action="mark-visited" data-account-id="${escapeHtml(accountId)}">
        ${icon(alreadyVisited ? "check" : "map-pin-check")}${alreadyVisited ? "Visited today · Next stop" : "Mark visited and continue"}
      </button>
      <button class="btn btn--secondary btn--full" type="button" data-action="skip-stop">${icon("skip-forward")}Skip for now</button>
      <button class="btn btn--quiet btn--full" type="button" data-action="exit-focus">Exit focus mode</button>
    </div>`;

  return appScreen({
    route: "focus",
    field,
    focus: true,
    showNav: false,
    ambient: health.grade === "A" ? "pine" : health.grade === "D" || health.grade === "F" ? "canyon" : "amber",
    header: screenHeader({
      eyebrow: `Stop ${active.index + 1} of ${active.accountIds.length}`,
      title: displayAccountName(account),
      subtitle: `${active.accountIds.length - active.index - 1} stops after this one`,
      back: true
    }),
    controls: `<div class="focus-progress">${progressBar(progress)}</div>`,
    content,
    isOnline: context.isOnline
  });
}
