/* Alpenglow v0.10 app frame. */
(function () {
  "use strict";

  const root = document.getElementById("root");
  const u = window.AlpenglowUtils;
  const store = window.AlpenglowStore;
  const select = window.AlpenglowSelectors;
  const price = window.AlpenglowPricing;
  const media = window.AlpenglowMedia;

  const NOTE_TYPES = ["General", "Opportunity", "Issue", "Follow Up", "Order"];
  const ELITE_STATUSES = ["To Do", "Done", "Rejected"];
  const COMPLIANCE = [
    ["priceTags", "Price Tags Check"],
    ["outOfCode", "Out-of-Code Walk"],
    ["rebates", "Rebates Up In Account"],
    ["pocm", "POCM Up In Account"],
    ["merchSurvey", "Merch / Space Survey"],
  ];
  const VOID_LABELS = { chain: "Chain Mod Voids", scaleUp: "Scale Up", perfectLaunch: "Perfect Launch" };
  const ACCOUNT_FILTERS = [
    ["today", "Today"],
    ["all", "All"],
    ["priority", "Priority"],
    ["notDone", "Not Done"],
    ["dsd", "DSD"],
    ["chain", "Chain"],
    ["independent", "Independent"],
    ["onPremise", "On-Prem"],
  ];
  const SORT_OPTIONS = [
    ["route", "Route Order"],
    ["name", "Account Name"],
    ["opps", "Open Opps"],
    ["totalOpps", "Total Opps"],
    ["survey", "Survey Needed"],
    ["outOfCode", "OOC Needed"],
    ["type", "Type"],
    ["lastVisit", "Last Visit"],
  ];
  const FILE_ACTIONS = new Set(["legacy-import", "attach-photo", "attach-voice"]);
  const UNDO_ACTION_LABELS = {
    "score-step": "Scoreboard changed",
    "mark-visited": "Visit status changed",
    "toggle-compliance": "Compliance changed",
    "cycle-void": "Void tracker changed",
    "cycle-distro": "Distro tracker changed",
    "delete-distro": "Distro SKU removed",
    "add-distro": "Distro SKU added",
    "add-elite-task": "Elite task added",
    "cycle-elite-task": "Elite task changed",
    "save-pricing": "Pricing saved",
    "delete-pricing": "Pricing deleted",
    "save-note": "Note saved",
    "route-up": "Route order changed",
    "route-down": "Route order changed",
    "apply-import": "Import applied",
    "reset-seed": "Local data reset",
  };
  const ACCENT_OPTIONS = [["amber", "Amber"], ["gold", "Gold"], ["ember", "Ember"]];
  const GLASS_OPTIONS = [["clear", "Clear"], ["medium", "Medium"], ["strong", "Strong"]];
  const FREQUENCY_OPTIONS = ["Weekly", "Twice Weekly", "Every Other Week", "Monthly"];
  const WORK_STATE_RANK = { Open: 0, "To Do": 0, Rejected: 1, Done: 2, "Sold In": 2 };
  let searchRenderTimer = 0;
  let undoSnapshot = null;
  let undoTimer = 0;
  const scrollMemory = {};
  const deferredUndo = {};

  function iconSvg(name) {
    const icons = {
      dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>',
      accounts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
      activity: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M7 15l4-4 3 3 4-7"/><path d="M18 7h-4"/><path d="M18 7v4"/></svg>',
      more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/></svg>',
      back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></svg>',
      sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16"/><path d="m4 7 3-3 3 3"/><path d="M17 20V4"/><path d="m14 17 3 3 3-3"/></svg>',
      photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h3l1.5-2h5L16 7h3v12H5z"/><path d="M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"/></svg>',
      voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    };
    return icons[name] || "";
  }

  function navButton(id, icon, label, active) {
    return `<button class="bottom-nav__item ${active === id ? "active" : ""}" data-action="nav" data-screen="${id}">
      <span class="bottom-nav__icon">${iconSvg(icon)}</span>
      <span class="bottom-nav__label">${u.escapeHtml(label)}</span>
    </button>`;
  }

  function bottomNav(active) {
    return `<nav class="bottom-nav" aria-label="Primary">
      ${navButton("dashboard", "dashboard", "Dashboard", active)}
      ${navButton("accounts", "accounts", "Accounts", active)}
      ${navButton("activity", "activity", "Activity", active)}
      ${navButton("more", "more", "More", active)}
    </nav>`;
  }

  function applyTheme(settings) {
    const body = document.body;
    if (!body) return;
    const theme = settings || {};
    body.dataset.accent = ["amber", "gold", "ember"].includes(theme.accent) ? theme.accent : "amber";
    body.dataset.glass = ["clear", "medium", "strong"].includes(theme.glass) ? theme.glass : "medium";
    body.classList.toggle("dark-mode", !!theme.darkMode);
  }

  function dayTabs(ui) {
    return `<div class="glass-tabs">${u.DAY_ORDER.map((day) => `
      <button class="glass-tab ${ui.selectedDay === day ? "on" : ""}" data-action="day" data-day="${day}">
        ${u.DAY_LABELS[day]}
      </button>`).join("")}</div>`;
  }

  function routeEditorTabs(ui) {
    const selected = u.DAY_ORDER.includes(ui.routeEditorDay) ? ui.routeEditorDay : ui.selectedDay;
    return `<div class="glass-tabs route-editor-tabs">${u.DAY_ORDER.map((day) => `
      <button class="glass-tab ${selected === day ? "on" : ""}" data-action="route-editor-day" data-day="${day}">
        ${u.DAY_LABELS[day]}
      </button>`).join("")}</div>`;
  }

  function sectionCollapsed(ui, id, defaultCollapsed) {
    const panels = ui.collapsedPanels || {};
    return Object.prototype.hasOwnProperty.call(panels, id) ? !!panels[id] : !!defaultCollapsed;
  }

  function accountSectionCard(id, title, body, collapsed, action, options) {
    const collapsible = !options || options.collapsible !== false;
    return `<div class="card account-section-card ${collapsed ? "is-collapsed" : ""} ${collapsible ? "" : "account-section-card--static"}">
      <div class="section-header">
        <div class="t-cap">${u.escapeHtml(title)}</div>
        ${collapsible ? `<button class="link-btn account-collapse-toggle" data-action="toggle-panel" data-panel="${u.escapeHtml(id)}">${collapsed ? "Show" : "Hide"}</button>` : ""}
        ${action || ""}
      </div>
      ${collapsible && collapsed ? "" : `<div class="account-section-body">${body}</div>`}
    </div>`;
  }

  function accountPanel(accountNumber, tab, body) {
    return `<div class="account-tab-panel" data-scroll-key="account:${u.escapeHtml(accountNumber)}:${u.escapeHtml(tab)}">${body}</div>`;
  }

  function metric(label, value, sub, tone, field) {
    return `<div class="metric-card metric-card--${tone || "neutral"}">
      <div class="metric-card__head">
        <div class="t-cap">${u.escapeHtml(label)}</div>
        ${field ? `<div class="stepper">
          <button class="stepper__btn" data-action="score-step" data-field="${field}" data-delta="-1" aria-label="Decrease ${u.escapeHtml(label)}">-</button>
          <button class="stepper__btn" data-action="score-step" data-field="${field}" data-delta="1" aria-label="Increase ${u.escapeHtml(label)}">+</button>
        </div>` : ""}
      </div>
      <div class="metric-card__value">${u.escapeHtml(value)}</div>
      ${sub ? `<div class="t-tiny">${u.escapeHtml(sub)}</div>` : ""}
    </div>`;
  }

  function progressBar(pct) {
    return `<div class="progress-track"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
  }

  function healthGradeFromScore(score) {
    if (score >= 85) return { grade: "A", tone: "good", label: "healthy" };
    if (score >= 70) return { grade: "B", tone: "good", label: "steady" };
    if (score >= 55) return { grade: "C", tone: "warn", label: "watch" };
    return { grade: "D", tone: "bad", label: "focus" };
  }

  function accountHealth(state, accountNumber) {
    const openOpps = select.opportunityCount(state, accountNumber, true);
    if (openOpps === 0) return { grade: "A", tone: "good", label: "clean" };
    if (openOpps <= 2) return { grade: "B", tone: "good", label: "steady" };
    if (openOpps <= 5) return { grade: "C", tone: "warn", label: "watch" };
    return { grade: "D", tone: "bad", label: "risk" };
  }

  function accountHealthScore(state, accountNumber) {
    const accountState = select.accountState(state, accountNumber);
    const openOpps = select.opportunityCount(state, accountNumber, true);
    const distroItems = Object.values(accountState.distro || {});
    const distroSold = distroItems.filter((item) => item.state === "Sold In").length;
    const distroScore = distroItems.length ? Math.round((distroSold / distroItems.length) * 18) : 10;
    return Math.max(52, Math.min(98, 92 + distroScore - Math.min(38, openOpps * 5)));
  }

  function circleMeter(value, label, tone) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="circle-meter circle-meter--${tone || "amber"}" style="--pct:${pct}">
      <span>${pct}%</span>
      ${label ? `<small>${u.escapeHtml(label)}</small>` : ""}
    </div>`;
  }

  function insightTile(label, value, sub, tone, valueIsHtml) {
    return `<div class="insight-tile ${tone ? `insight-tile--${tone}` : ""}">
      <div class="t-cap">${u.escapeHtml(label)}</div>
      <div class="insight-tile__value">${valueIsHtml ? value : u.escapeHtml(value)}</div>
      ${sub ? `<div class="t-tiny">${u.escapeHtml(sub)}</div>` : ""}
    </div>`;
  }

  function distroDriveStrip(distro) {
    return `<div class="distro-drive-strip">
      <div class="distro-drive-strip__head">
        <span>Distro Drive</span>
        <b>${distro.pct}%</b>
      </div>
      ${progressBar(distro.pct)}
      <div class="distro-drive-strip__sub">${distro.sold} of ${distro.total} sold in</div>
    </div>`;
  }

  function dashboardInsights(state, ui, progress, health) {
    const accounts = select.accountsForDay(state, ui.selectedDay);
    let openOpps = 0;
    let followUps = 0;
    accounts.forEach((accountNumber) => {
      const accountState = select.accountState(state, accountNumber);
      openOpps += select.opportunityCount(state, accountNumber, true);
      (accountState.notes || []).forEach((note) => {
        if (note.followUpDate && note.followUpDate <= u.todayKey()) followUps += 1;
      });
    });
    const remaining = Math.max(0, progress.total - progress.visited);
    const routeGrade = healthGradeFromScore(health);
    return [
      insightTile("Remaining", remaining, remaining === 1 ? "account left" : "accounts left"),
      insightTile("Day Health", `<span class="health-grade health-grade--${routeGrade.tone}">${routeGrade.grade}</span>`, "score", routeGrade.tone, true),
      insightTile("Opps", openOpps, "voids + distro", openOpps > 5 ? "bad" : openOpps ? "warn" : "good"),
      insightTile("Follow-Up", followUps, followUps ? "due now" : "clear", followUps ? "warn" : "good"),
    ].join("");
  }

  function dashboardQuote(day) {
    const quotes = {
      mon: "Start clean.",
      tue: "Win the next stop.",
      wed: "Keep momentum.",
      thu: "Stack small wins.",
      fri: "Finish strong.",
    };
    return quotes[day] || "Keep moving.";
  }

  function stateClass(value) {
    const token = String(value || "Open").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "open";
    return `state-pill state-pill--${token}`;
  }

  function accountFilterCount(state, ui, filter) {
    return select.filteredAccounts(state, { ...ui, accountFilter: filter, accountSearch: "" }).length;
  }

  function openNextStop(state, ui) {
    const routeAccounts = select.filteredAccounts(state, { ...ui, accountFilter: "today", accountSearch: "", accountSort: "route" });
    const next = routeAccounts.find((account) => !select.isVisited(state, account.accountNumber, ui.selectedDay)) || routeAccounts[0];
    if (!next) return;
    store.setUi({ screen: "accounts", accountFilter: "today", selectedAccount: next.accountNumber, accountTab: "today" });
  }

  function currentObjective(objectives) {
    return (objectives && (objectives.current || Object.values(objectives).find(Boolean))) || "";
  }

  function fieldInput(action, field, label, value, type) {
    return `<label class="field-label">${u.escapeHtml(label)}
      <input class="field-input" type="${type || "text"}" inputmode="${type === "number" ? "decimal" : "text"}" data-action="${action}" data-field="${field}" value="${u.escapeHtml(value || "")}">
    </label>`;
  }

  function fieldTextarea(action, field, label, value) {
    return `<label class="field-label">${u.escapeHtml(label)}
      <textarea class="field-textarea field-textarea--compact" data-action="${action}" data-field="${field}">${u.escapeHtml(value || "")}</textarea>
    </label>`;
  }

  function fieldSelect(action, field, label, value, options) {
    return `<label class="field-label">${u.escapeHtml(label)}
      <select class="field-input" data-action="${action}" data-field="${field}">
        ${options.map((option) => `<option value="${u.escapeHtml(option)}" ${value === option ? "selected" : ""}>${u.escapeHtml(option)}</option>`).join("")}
      </select>
    </label>`;
  }

  function emptyAccountState() {
    return {
      visited: {},
      compliance: {},
      survey: {},
      objectives: {},
      notes: [],
      voids: { chain: {}, scaleUp: {}, perfectLaunch: {} },
      distro: {},
      pricing: {},
      eliteTasks: {},
      history: [],
    };
  }

  function ensureAccountState(next, accountNumber) {
    const accountState = next.accountState[accountNumber] || emptyAccountState();
    accountState.visited = accountState.visited || {};
    accountState.compliance = accountState.compliance || {};
    accountState.survey = accountState.survey || {};
    accountState.objectives = accountState.objectives || {};
    accountState.notes = accountState.notes || [];
    accountState.voids = accountState.voids || { chain: {}, scaleUp: {}, perfectLaunch: {} };
    accountState.voids.chain = accountState.voids.chain || {};
    accountState.voids.scaleUp = accountState.voids.scaleUp || {};
    accountState.voids.perfectLaunch = accountState.voids.perfectLaunch || {};
    accountState.distro = accountState.distro || {};
    accountState.pricing = accountState.pricing || {};
    accountState.eliteTasks = accountState.eliteTasks || {};
    accountState.history = accountState.history || [];
    next.accountState[accountNumber] = accountState;
    return accountState;
  }

  function blankPricingDraft() {
    return {
      id: "",
      sku: "",
      caseCost: "",
      unitsPerCase: "",
      retailPrice: "",
      retailUnitQty: "1",
      targetMargin: "",
      twoForPrice: "",
      competitorSku: "",
      competitorPrice: "",
      notes: "",
    };
  }

  function accountRow(state, account, ui, index) {
    const accountState = select.accountState(state, account.accountNumber);
    const visited = select.isVisited(state, account.accountNumber, ui.selectedDay);
    const opps = select.opportunityCount(state, account.accountNumber, true);
    const totalOpps = select.opportunityCount(state, account.accountNumber, false);
    const surveyDone = select.complianceDone(state, account.accountNumber, "merchSurvey");
    const outOfCodeNeeded = !select.complianceDone(state, account.accountNumber, "outOfCode");
    const health = accountHealth(state, account.accountNumber);
    const healthScore = accountHealthScore(state, account.accountNumber);
    const subtitle = u.accountSubtitle(account);
    return `<button class="account-row account-row--button" data-action="open-account" data-account="${account.accountNumber}">
      <span class="account-row__dot ${visited ? "done" : ""}">${visited ? iconSvg("check") : index + 1}</span>
      <span class="account-row__body">
        <span class="account-row__topline">
          <span class="t-label">${u.escapeHtml(u.accountName(account))}</span>
          <span class="account-score account-score--${health.tone}">${healthScore}</span>
        </span>
        <span class="t-tiny">${u.escapeHtml(subtitle)}</span>
        <span class="account-row__stats">
          <span>Survey <b class="${surveyDone ? "stat-good" : "stat-warn"}">${surveyDone ? "Done" : "Need"}</b></span>
          <span>OOC <b class="${outOfCodeNeeded ? "stat-warn" : "stat-good"}">${outOfCodeNeeded ? "Need" : "Done"}</b></span>
          <span>Opps <b>${totalOpps || opps}</b></span>
        </span>
      </span>
      <span class="account-row__meta">
        <span>#${u.escapeHtml(account.accountNumber)}</span>
        <span class="visit-pill">${visited ? "Done" : "Visit"}</span>
      </span>
    </button>`;
  }

  function dashboard(state, ui) {
    const progress = select.routeProgress(state, ui.selectedDay);
    const distro = select.distroProgress(state, ui.selectedDay);
    const score = select.scoreboard(state, ui.selectedDay);
    const health = select.routeHealth(state, ui.selectedDay);
    const openOpps = select.accountsForDay(state, ui.selectedDay)
      .reduce((sum, accountNumber) => sum + select.opportunityCount(state, accountNumber, true), 0);
    const remaining = Math.max(0, progress.total - progress.visited);
    return `<header class="hero-band">
        <div class="hero-band__eyebrow">Route 508 - ${u.DAY_LABELS[ui.selectedDay]}</div>
        <h1 class="hero-band__title">Hey, P.</h1>
        <p class="hero-band__sub">${remaining} ${remaining === 1 ? "account" : "accounts"} left. ${dashboardQuote(ui.selectedDay)}</p>
      </header>
      <div class="glass-shell glass-shell--floating">
      <section class="content-stack">
        ${dayTabs(ui)}
        <div class="card card-pad route-progress-card">
          <div class="row-spread route-progress__head">
            <div class="t-cap">Route Progress</div>
            <span class="today-pill">${u.DAY_LABELS[ui.selectedDay]}</span>
          </div>
          <div class="route-progress__cockpit">
            ${circleMeter(progress.pct, "done", "amber")}
            <div class="route-progress__legend">
              <span><i class="legend-dot legend-dot--visited"></i>Visited <b>${progress.visited}</b></span>
              <span><i class="legend-dot legend-dot--pending"></i>Pending <b>${Math.max(0, progress.total - progress.visited)}</b></span>
              <span><i class="legend-dot legend-dot--opps"></i>Open Opps <b>${openOpps}</b></span>
            </div>
          </div>
          ${progressBar(progress.pct)}
          <button class="btn btn--primary btn--full" data-action="start-route">Start Route</button>
        </div>
        <div class="glass-section glance-panel">
          <div class="section-minihead">
            <div>
              <h2 class="glance-title">Today at a Glance</h2>
            </div>
          </div>
          ${distroDriveStrip(distro)}
          <div class="insight-strip">${dashboardInsights(state, ui, progress, health)}</div>
        </div>
        <div class="glass-section scoreboard-panel">
          <div class="section-minihead">
            <div>
              <h2 class="glance-title">Elite Scoreboard</h2>
            </div>
          </div>
          <div class="dashboard-grid">
            ${metric("Displays", score.displays, "", "good", "d")}
            ${metric("PODs", score.pods, "", "warn", "p")}
            ${metric("Taps", score.taps, "", "neutral", "t")}
            ${metric("Resets", score.resets, "", "neutral", "r")}
          </div>
        </div>
      </section>
      ${bottomNav("dashboard")}
    </div>`;
  }

  function accountsScreen(state, ui) {
    const accounts = select.filteredAccounts(state, ui);
    const routeProgress = select.routeProgress(state, ui.selectedDay);
    const remaining = Math.max(0, routeProgress.total - routeProgress.visited);
    const primaryFilters = ACCOUNT_FILTERS.slice(0, 4);
    return `<header class="hero-band hero-band--accounts">
        <div class="hero-band__eyebrow">Route 508 - ${u.DAY_LABELS[ui.selectedDay]}</div>
        <h1 class="hero-band__title">My Route</h1>
        <p class="hero-band__sub">${remaining} ${remaining === 1 ? "account" : "accounts"} left. Pick the next win.</p>
      </header>
      <div class="glass-shell glass-shell--floating accounts-shell">
      <section class="content-stack accounts-stack">
        ${dayTabs(ui)}
        <div class="glass-tabs account-filter-tabs">
          ${primaryFilters.map(([filter, label]) => `<button class="glass-tab ${ui.accountFilter === filter ? "on" : ""}" data-action="filter" data-filter="${filter}">${label}${filter !== "today" ? ` (${accountFilterCount(state, ui, filter)})` : ""}</button>`).join("")}
        </div>
        <div class="accounts-tool-panel glass-section">
          <label class="accounts-search-card" aria-label="Search accounts">
            <span class="accounts-search-icon">${iconSvg("search")}</span>
            <input class="accounts-search-input" data-action="account-search" value="${u.escapeHtml(ui.accountSearch || "")}" placeholder="Search name, nickname, #, town">
          </label>
        </div>
        <div class="accounts-control-row">
          <label class="accounts-sort-control">
            <span>${iconSvg("sort")}</span>
            <select data-action="sort">
              ${SORT_OPTIONS.map(([sort, label]) => `<option value="${sort}" ${ui.accountSort === sort ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="account-list">${accounts.map((account, index) => accountRow(state, account, ui, index)).join("") || `<div class="card empty">No accounts match this view.</div>`}</div>
      </section>
      <button class="btn btn--primary btn--full accounts-next-stop" data-action="start-next-stop">Start Next Stop</button>
      ${bottomNav("accounts")}
    </div>`;
  }

  function renderAccountRowsOnly() {
    const state = store.getState();
    const ui = store.getUi();
    const list = root.querySelector(".accounts-shell .account-list");
    if (!list || !list.isConnected) return;
    const accounts = select.filteredAccounts(state, ui);
    const template = document.createElement("template");
    template.innerHTML = accounts.map((account, index) => accountRow(state, account, ui, index)).join("") || `<div class="card empty">No accounts match this view.</div>`;
    list.replaceChildren(...template.content.childNodes);
  }

  function accountTypeLabel(account) {
    const type = String(account.type || "").trim();
    if (type === "onPremise") return "On-Prem";
    if (type === "independent") return "Independent";
    if (type === "chain") return "Chain";
    return type || "Account";
  }

  function accountIdentifier(account) {
    const parts = [`#${account.accountNumber}`];
    if (account.chainStoreNumber) parts.push(`Store ${account.chainStoreNumber}`);
    parts.push(accountTypeLabel(account));
    return parts.filter(Boolean).join(" • ");
  }

  function accountHero(state, ui, account) {
    const health = accountHealth(state, account.accountNumber);
    const score = accountHealthScore(state, account.accountNumber);
    const visited = select.isVisited(state, account.accountNumber, ui.selectedDay);
    const displayName = u.accountName(account);
    const routeLabel = `${u.DAY_LABELS[ui.selectedDay]} Route`;
    return `<header class="hero-band hero-band--account">
      <button class="account-hero-back" data-action="back-accounts" aria-label="Back to Accounts">${iconSvg("back")}</button>
      <div class="account-hero__copy">
        <div class="hero-band__eyebrow">Route 508 - ${u.DAY_LABELS[ui.selectedDay]}</div>
        <h1 class="hero-band__title">${u.escapeHtml(displayName)}</h1>
        <p class="hero-band__sub">${u.escapeHtml(account.nickname || routeLabel)} • ${u.escapeHtml(accountIdentifier(account))}</p>
        <button class="account-hero-visit ${visited ? "is-done" : ""}" data-action="mark-visited">${visited ? "Visited Today" : "Mark Visited"}</button>
      </div>
      <div class="account-hero-score account-hero-score--${health.tone}">
        <b>${score}</b>
        <span>${u.escapeHtml(health.grade)}</span>
      </div>
    </header>`;
  }

  function utilityHero(title, subtitle) {
    return `<header class="hero-band hero-band--utility">
      <div class="hero-band__eyebrow">Route 508</div>
      <h1 class="hero-band__title">${u.escapeHtml(title)}</h1>
      <p class="hero-band__sub">${u.escapeHtml(subtitle)}</p>
    </header>`;
  }

  function accountTabs(ui) {
    return `<div class="glass-tabs account-tabs">
      ${["today", "details", "notes"].map((tab) => `<button class="glass-tab ${ui.accountTab === tab ? "on" : ""}" data-action="account-tab" data-tab="${tab}">${tab === "today" ? "Today" : tab === "details" ? "Details" : "Notes"}</button>`).join("")}
    </div>`;
  }

  function complianceCard(accountState, ui) {
    const collapsed = sectionCollapsed(ui, "accountCompliance", true);
    return accountSectionCard("accountCompliance", "Compliance Checklist", COMPLIANCE.map(([key, label]) => {
        const item = (accountState.compliance || {})[key] || {};
        return `<button class="check-row" data-action="toggle-compliance" data-check="${key}">
          <span>${u.escapeHtml(label)}</span>
          <span class="check-state ${item.done ? "done" : ""}">${item.done ? `${iconSvg("check")} ${u.formatDate(item.doneAt)}` : "Open"}</span>
        </button>`;
      }).join(""), collapsed);
  }

  function recordList(bucket, records, ui, limit, showEmpty) {
    const entries = Object.entries(records || {}).filter(([, item]) => ui.voidView === "all" || (item.state || "Open") === "Open");
    return entries.slice(0, limit || 8).map(([sku, item]) => `<button class="void-row" data-action="cycle-void" data-bucket="${bucket}" data-sku="${u.escapeHtml(sku)}">
      <span class="void-row__sku">${u.escapeHtml(sku)}</span>
      <span class="${stateClass(item.state)}">${u.escapeHtml(item.state || "Open")}</span>
    </button>`).join("") || (showEmpty === false ? "" : `<div class="empty">No ${ui.voidView === "all" ? "" : "open "}items.</div>`);
  }

  function workRank(state) {
    return Object.prototype.hasOwnProperty.call(WORK_STATE_RANK, state) ? WORK_STATE_RANK[state] : 1;
  }

  function distroCard(accountState, ui, limit) {
    const entries = Object.entries(accountState.distro || {}).sort(([skuA, itemA], [skuB, itemB]) => {
      const rank = workRank(itemA.state || "Open") - workRank(itemB.state || "Open");
      return rank || String(skuA).localeCompare(String(skuB));
    });
    const visibleEntries = ui.distroView === "all" ? entries : entries.slice(0, limit || 6);
    const draft = ui.distroDraft || { sku: "" };
    const collapsed = sectionCollapsed(ui, "accountDistro", true);
    const addCollapsed = sectionCollapsed(ui, "accountDistroAdd", true);
    const action = entries.length > (limit || 6) ? `<button class="link-btn" data-action="toggle-distro-view">${ui.distroView === "all" ? "Less" : "All"}</button>` : "";
    return accountSectionCard("accountDistro", "Distro Drive", `
      ${visibleEntries.map(([sku, item]) => `<div class="work-row">
        <button class="work-row__body work-row__button" data-action="cycle-distro" data-sku="${u.escapeHtml(sku)}">
          <b>${u.escapeHtml(sku)}</b>
          <span>${u.escapeHtml(item.source || "Distro Drive")}</span>
        </button>
        <button class="${stateClass(item.state)}" data-action="cycle-distro" data-sku="${u.escapeHtml(sku)}">${u.escapeHtml(item.state || "Open")}</button>
        ${item.source === "Manual" ? `<button class="link-btn link-btn--danger" data-action="delete-distro" data-sku="${u.escapeHtml(sku)}">Remove</button>` : ""}
      </div>`).join("") || `<div class="empty">No distro items for this account.</div>`}
      ${addCollapsed ? `<button class="btn btn--ghost btn--full account-add-cta" data-action="toggle-panel" data-panel="accountDistroAdd">Add new distro item</button>` : `
        <div class="inline-add">
          <input class="field-input" data-action="distro-draft" data-field="sku" placeholder="SKU or item to track" value="${u.escapeHtml(draft.sku || "")}">
          <button class="btn btn--primary" data-action="add-distro">Add</button>
        </div>
        <button class="link-btn account-form-cancel" data-action="toggle-panel" data-panel="accountDistroAdd">Cancel</button>
      `}
    `, collapsed, action);
  }

  function eliteCard(accountState, ui) {
    const draft = ui.eliteDraft || {};
    const tasks = Object.values(accountState.eliteTasks || {}).sort((a, b) => {
      const rank = workRank(a.status || "To Do") - workRank(b.status || "To Do");
      return rank || String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    const collapsed = sectionCollapsed(ui, "accountElite", true);
    const addCollapsed = sectionCollapsed(ui, "accountEliteAdd", true);
    return accountSectionCard("accountElite", "Elite Tasks", `
      ${tasks.map((task) => `<div class="work-row">
        <div class="work-row__body">
          <b>${u.escapeHtml(task.title || "Untitled Task")}</b>
          ${task.detail ? `<span>${u.escapeHtml(task.detail)}</span>` : ""}
          ${task.dueDate ? `<span class="t-tiny">Due ${u.formatDate(task.dueDate)}</span>` : ""}
        </div>
        <button class="${stateClass(task.status)}" data-action="cycle-elite-task" data-task="${u.escapeHtml(task.id)}">${u.escapeHtml(task.status || "To Do")}</button>
      </div>`).join("") || `<div class="empty">No Elite tasks linked to this account yet.</div>`}
      ${addCollapsed ? `<button class="btn btn--ghost btn--full account-add-cta" data-action="toggle-panel" data-panel="accountEliteAdd">Add new Elite task</button>` : `
        <div class="form-grid form-grid--pad">
          ${fieldInput("elite-draft", "title", "Task", draft.title)}
          ${fieldSelect("elite-draft", "status", "Status", draft.status || "To Do", ELITE_STATUSES)}
          ${fieldInput("elite-draft", "dueDate", "Due Date", draft.dueDate, "date")}
          ${fieldTextarea("elite-draft", "detail", "Details", draft.detail)}
          <button class="btn btn--primary btn--full" data-action="add-elite-task">Add Elite Task</button>
        </div>
        <button class="link-btn account-form-cancel" data-action="toggle-panel" data-panel="accountEliteAdd">Cancel</button>
      `}
    `, collapsed);
  }

  function todayTab(state, ui, account, accountState) {
    const visited = select.isVisited(state, account.accountNumber, ui.selectedDay);
    const latestNotes = (accountState.notes || []).slice(-2).reverse();
    const health = accountHealth(state, account.accountNumber);
    const openOpps = select.opportunityCount(state, account.accountNumber, true);
    const totalOpps = select.opportunityCount(state, account.accountNumber, false);
    const distro = Object.values(accountState.distro || {});
    const soldDistro = distro.filter((item) => item.state === "Sold In").length;
    const distroPct = distro.length ? Math.round((soldDistro / distro.length) * 100) : 0;
    const surveyDone = select.complianceDone(state, account.accountNumber, "merchSurvey");
    const outOfCodeDone = select.complianceDone(state, account.accountNumber, "outOfCode");
    return accountPanel(account.accountNumber, "today", `
      <section class="glance-panel account-glance-panel">
        <div class="section-minihead"><div><h2 class="glance-title">Today Signals</h2></div></div>
        <div class="distro-drive-strip account-distro-strip">
          <div class="distro-drive-strip__head"><span>Distro Drive</span><b>${distroPct}%</b></div>
          ${progressBar(distroPct)}
          <div class="distro-drive-strip__sub">${soldDistro} of ${distro.length} sold in</div>
        </div>
        <div class="insight-strip account-insight-strip">
          <div class="insight-tile insight-tile--${health.tone}">
            <div class="t-cap">Day Health</div>
            <div class="insight-tile__value">${u.escapeHtml(health.grade)}</div>
            <div class="t-tiny">score</div>
          </div>
          <div class="insight-tile ${surveyDone ? "insight-tile--good" : "insight-tile--warn"}">
            <div class="t-cap">Survey</div>
            <div class="insight-tile__value">${surveyDone ? "Done" : "Need"}</div>
            <div class="t-tiny">completion</div>
          </div>
          <div class="insight-tile ${outOfCodeDone ? "insight-tile--good" : "insight-tile--warn"}">
            <div class="t-cap">OOC</div>
            <div class="insight-tile__value">${outOfCodeDone ? "Done" : "Need"}</div>
            <div class="t-tiny">walk</div>
          </div>
          <div class="insight-tile ${openOpps ? "insight-tile--bad" : "insight-tile--good"}">
            <div class="t-cap">Opps</div>
            <div class="insight-tile__value">${totalOpps}</div>
            <div class="t-tiny">${openOpps} open</div>
          </div>
        </div>
      </section>
      ${complianceCard(accountState, ui)}
      ${distroCard(accountState, ui)}
      ${eliteCard(accountState, ui)}
      <div class="card card-pad">
        <h2 class="t-title">Last Two Notes</h2>
        ${latestNotes.map((note) => `<p class="note-preview"><b>${u.escapeHtml(note.type)}</b><br>${u.escapeHtml(note.body)}</p>`).join("") || `<p class="t-sub">No notes yet.</p>`}
      </div>
    `);
  }

  function pricingTracker(accountState, ui) {
    const draft = ui.pricingDraft || blankPricingDraft();
    const entries = Object.values(accountState.pricing || {}).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return accountSectionCard("accountPricing", "Pricing Tracker", `
      <div class="form-grid form-grid--pad">
        ${fieldInput("pricing-draft", "sku", "SKU / Product", draft.sku)}
        <div class="form-grid form-grid--two">
          ${fieldInput("pricing-draft", "caseCost", "Case Cost", draft.caseCost, "number")}
          ${fieldInput("pricing-draft", "unitsPerCase", "Units / Case", draft.unitsPerCase, "number")}
        </div>
        <div class="form-grid form-grid--two">
          ${fieldInput("pricing-draft", "retailPrice", "Retail Price", draft.retailPrice, "number")}
          ${fieldInput("pricing-draft", "retailUnitQty", "Retail Qty", draft.retailUnitQty || "1", "number")}
        </div>
        <div class="form-grid form-grid--two">
          ${fieldInput("pricing-draft", "targetMargin", "Target Margin %", draft.targetMargin, "number")}
          ${fieldInput("pricing-draft", "twoForPrice", "2-for Price", draft.twoForPrice, "number")}
        </div>
        <div class="form-grid form-grid--two">
          ${fieldInput("pricing-draft", "competitorSku", "Competition SKU", draft.competitorSku)}
          ${fieldInput("pricing-draft", "competitorPrice", "Competition Price", draft.competitorPrice, "number")}
        </div>
        ${fieldTextarea("pricing-draft", "notes", "Notes", draft.notes)}
        <div class="button-row">
          <button class="btn btn--primary" data-action="save-pricing">${draft.id ? "Update SKU" : "Add SKU"}</button>
          ${draft.id ? `<button class="btn btn--ghost" data-action="clear-pricing-draft">Cancel</button>` : ""}
        </div>
      </div>
      ${entries.map((item) => {
        const metrics = price.calculate(item);
        return `<div class="pricing-row">
          <div class="pricing-row__head">
            <b>${u.escapeHtml(item.sku || "Tracked SKU")}</b>
            <span>${u.escapeHtml(item.competitorSku || "")}</span>
          </div>
          <div class="pricing-metrics">
            <span><b>${price.money(metrics.unitCost)}</b><small>unit cost</small></span>
            <span><b>${price.pct(metrics.currentMargin)}</b><small>margin</small></span>
            <span><b>${price.pct(metrics.marginGap)}</b><small>gap</small></span>
            <span><b>${price.money(metrics.suggestedRetail)}</b><small>target retail</small></span>
          </div>
          ${item.notes ? `<p class="t-sub">${u.escapeHtml(item.notes)}</p>` : ""}
          <div class="button-row">
            <button class="link-btn" data-action="edit-pricing" data-price="${u.escapeHtml(item.id)}">Edit</button>
            <button class="link-btn link-btn--danger" data-action="delete-pricing" data-price="${u.escapeHtml(item.id)}">Delete</button>
          </div>
        </div>`;
      }).join("") || `<div class="empty">No SKUs are being tracked for pricing yet.</div>`}
    `, sectionCollapsed(ui, "accountPricing", true));
  }

  function detailsTab(state, ui, account, accountState) {
    const infoFields = [
      ["buyer", "Buyer"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["address", "Address"],
    ];
    return accountPanel(account.accountNumber, "details", `
      ${accountSectionCard("accountObjective", "This Week's Objective", `
        <textarea class="field-textarea" data-action="objective">${u.escapeHtml(currentObjective(accountState.objectives || {}))}</textarea>
      `, false, "", { collapsible: false })}
      ${accountSectionCard("accountInfo", "Account Info", `
        <div class="form-grid form-grid--pad">
          ${infoFields.map(([field, label]) => `<label class="field-label">${label}<input class="field-input" data-action="account-field" data-field="${field}" value="${u.escapeHtml(account[field] || "")}"></label>`).join("")}
        </div>
      `, sectionCollapsed(ui, "accountInfo", true))}
      ${pricingTracker(accountState, ui)}
      ${accountSectionCard("accountVoidTracker", "Void Tracker", `
        <div class="void-bucket-list">
          ${Object.entries(VOID_LABELS).map(([bucket, label]) => `<div class="subsection-title">${label}</div>${recordList(bucket, (accountState.voids || {})[bucket], { ...ui, voidView: "all" }, 6)}`).join("")}
        </div>
      `, false, "", { collapsible: false })}
    `);
  }

  function notesTab(ui, account, accountState) {
    const draft = store.getUi().noteDraft;
    const attachments = draft.attachments || [];
    return accountPanel(account.accountNumber, "notes", `
      ${accountSectionCard("accountStructuredNote", "Structured Note", `
        <div class="form-grid form-grid--two note-meta-grid">
          <label class="field-label">Type
            <select class="field-input" data-action="note-type">${NOTE_TYPES.map((type) => `<option ${draft.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
          </label>
          <label class="field-label">Follow-up Date
            <input class="field-input" type="date" data-action="note-followup" value="${u.escapeHtml(draft.followUpDate || "")}">
          </label>
        </div>
        <textarea class="field-textarea" data-action="note-body" placeholder="Capture opportunity, issue, order, or follow-up...">${u.escapeHtml(draft.body || "")}</textarea>
        <div class="media-actions">
          <label class="media-action"><span class="media-icon">${iconSvg("photo")}</span><span class="media-label">Photo</span><input class="visually-hidden" type="file" accept="image/*" capture="environment" data-action="attach-photo"></label>
          <label class="media-action"><span class="media-icon">${iconSvg("voice")}</span><span class="media-label">Voice Note</span><input class="visually-hidden" type="file" accept="audio/*" capture data-action="attach-voice"></label>
        </div>
        ${attachments.length ? `<div class="attachment-list">${attachments.map((item) => `<span>${u.escapeHtml(item.kind)}: ${u.escapeHtml(item.name)}</span>`).join("")}</div>` : ""}
        <button class="btn btn--primary btn--full" data-action="save-note">Save Note</button>
      `, false, "", { collapsible: false })}
      ${accountSectionCard("accountNotesTimeline", "Notes Timeline", `
        ${(accountState.notes || []).slice().reverse().map((note) => `<div class="note-item">
          <div class="row-spread"><b>${u.escapeHtml(note.type)}</b><span>${u.formatDate((note.createdAt || "").slice(0, 10))}</span></div>
          ${note.followUpDate ? `<div class="t-tiny">Follow-up ${u.formatDate(note.followUpDate)}</div>` : ""}
          <p>${u.escapeHtml(note.body)}</p>
          ${(note.attachments || []).length ? `<div class="attachment-list">${note.attachments.map((item) => `<span>${u.escapeHtml(item.kind)}: ${u.escapeHtml(item.name)}</span>`).join("")}</div>` : ""}
        </div>`).join("") || `<div class="empty">No notes yet.</div>`}
      `, sectionCollapsed(ui, "accountNotesTimeline", true))}
    `);
  }

  function accountScreen(state, ui) {
    const account = state.accounts[ui.selectedAccount];
    if (!account) return accountsScreen(state, { ...ui, screen: "accounts" });
    const accountState = select.accountState(state, account.accountNumber);
    const tab = ui.accountTab === "details" ? detailsTab(state, ui, account, accountState)
      : ui.accountTab === "notes" ? notesTab(ui, account, accountState)
      : todayTab(state, ui, account, accountState);
    return `${accountHero(state, ui, account)}
      <div class="glass-shell glass-shell--floating account-shell">
        <section class="content-stack account-stack">
          ${accountTabs(ui)}
          ${tab}
        </section>
        ${bottomNav("accounts")}
      </div>`;
  }

  function generateSummary(state, ui) {
    const accounts = select.accountsForDay(state, ui.selectedDay);
    const progress = select.routeProgress(state, ui.selectedDay);
    const score = select.scoreboard(state, ui.selectedDay);
    const sold = [];
    const notes = [];
    const pricingItems = [];
    const eliteDone = [];
    let complianceDone = 0;
    let voidsActioned = 0;
    accounts.forEach((accountNumber) => {
      const account = state.accounts[accountNumber];
      const stateForAccount = select.accountState(state, accountNumber);
      Object.entries(stateForAccount.distro || {}).forEach(([sku, item]) => {
        if (item.state === "Sold In") sold.push(`${u.accountName(account)}: ${sku}`);
      });
      (stateForAccount.notes || []).slice(-2).forEach((note) => notes.push(`${u.accountName(account)}: ${note.body}`));
      Object.values(stateForAccount.pricing || {}).forEach((item) => pricingItems.push(`${u.accountName(account)}: ${item.sku}`));
      Object.values(stateForAccount.eliteTasks || {}).forEach((task) => {
        if (task.status === "Done") eliteDone.push(`${u.accountName(account)}: ${task.title}`);
      });
      complianceDone += Object.values(stateForAccount.compliance || {}).filter((item) => item.done).length;
      ["chain", "scaleUp", "perfectLaunch"].forEach((bucket) => {
        voidsActioned += Object.values(((stateForAccount.voids || {})[bucket]) || {}).filter((item) => (item.state || "Open") !== "Open").length;
      });
    });
    return [
      `${u.DAY_LABELS[ui.selectedDay]} Route Summary`,
      `Accounts visited: ${progress.visited}/${progress.total}`,
      `Scoreboard: ${score.taps} taps - ${score.displays} displays - ${score.pods} PODs - ${score.resets} resets`,
      sold.length ? `Sold In:\n- ${sold.join("\n- ")}` : "Sold In: none recorded",
      `Compliance checks completed: ${complianceDone}`,
      `Voids actioned/tracked: ${voidsActioned}`,
      pricingItems.length ? `Pricing tracked:\n- ${pricingItems.slice(0, 12).join("\n- ")}` : "Pricing tracked: none recorded",
      eliteDone.length ? `Elite tasks completed:\n- ${eliteDone.join("\n- ")}` : "Elite tasks completed: none recorded",
      notes.length ? `Notes:\n- ${notes.join("\n- ")}` : "Notes: none recorded",
    ].join("\n\n");
  }

  function summarySnapshotKey(ui) {
    return `${u.todayKey()}-${ui.selectedDay}`;
  }

  function syncDailySummarySnapshot(state, ui, text) {
    const key = summarySnapshotKey(ui);
    const current = (((state.summaries || {}).daily || {})[key] || {}).text;
    if (current === text) return;
    store.update((next) => {
      next.summaries = next.summaries || {};
      next.summaries.daily = next.summaries.daily || {};
      next.summaries.daily[key] = {
        key,
        dateKey: u.todayKey(),
        day: ui.selectedDay,
        text,
        updatedAt: new Date().toISOString(),
      };
      const recent = Object.entries(next.summaries.daily)
        .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))
        .slice(0, 7);
      next.summaries.daily = Object.fromEntries(recent);
    });
  }

  function summarySnapshots(state) {
    return Object.values(((state.summaries || {}).daily) || {})
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 7);
  }

  function generateWeeklyPrep(state) {
    const dayLines = u.DAY_ORDER.map((day) => {
      const progress = select.routeProgress(state, day);
      const distro = select.distroProgress(state, day);
      const health = select.routeHealth(state, day);
      return `${u.DAY_LABELS[day]}: ${progress.visited}/${progress.total} visits, ${distro.sold}/${distro.total} distro, health ${health}`;
    });
    const sold = [];
    const followUps = [];
    const watchouts = [];
    let complianceDone = 0;
    let pricingCount = 0;
    let eliteDone = 0;
    Object.entries(state.accountState || {}).forEach(([accountNumber, accountState]) => {
      const account = state.accounts[accountNumber] || {};
      Object.entries(accountState.distro || {}).forEach(([sku, item]) => {
        if (item.state === "Sold In") sold.push(`${u.accountName(account)}: ${sku}`);
      });
      (accountState.notes || []).forEach((note) => {
        if (note.followUpDate) followUps.push(`${u.accountName(account)} ${u.formatDate(note.followUpDate)}: ${note.body}`);
      });
      pricingCount += Object.keys(accountState.pricing || {}).length;
      eliteDone += Object.values(accountState.eliteTasks || {}).filter((task) => task.status === "Done").length;
      complianceDone += Object.values(accountState.compliance || {}).filter((item) => item.done).length;
      const openOpps = select.opportunityCount(state, accountNumber, true);
      if (openOpps) watchouts.push(`${u.accountName(account)}: ${openOpps} open opportunities`);
    });
    return [
      "Alpenglow Weekly Prep",
      `Route health:\n- ${dayLines.join("\n- ")}`,
      sold.length ? `Wins / sold in:\n- ${sold.slice(0, 16).join("\n- ")}` : "Wins / sold in: none recorded yet",
      `Execution: ${complianceDone} compliance checks, ${pricingCount} pricing SKUs tracked, ${eliteDone} Elite tasks completed`,
      watchouts.length ? `Watchouts:\n- ${watchouts.slice(0, 12).join("\n- ")}` : "Watchouts: no open opportunities in tracked accounts",
      followUps.length ? `Follow-ups:\n- ${followUps.slice(0, 12).join("\n- ")}` : "Follow-ups: none dated yet",
    ].join("\n\n");
  }

  function mergeObject(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = target[key] || {};
        mergeObject(target[key], value);
      } else {
        target[key] = value;
      }
    });
  }

  function mergeLegacyImport(imported) {
    store.update((next) => {
      Object.entries(imported.accounts || {}).forEach(([accountNumber, importedAccount]) => {
        const current = next.accounts[accountNumber] || {};
        next.accounts[accountNumber] = {
          ...importedAccount,
          ...current,
          tags: Array.from(new Set([...(importedAccount.tags || []), ...(current.tags || [])])).sort(),
          sourceAliases: Array.from(new Set([...(importedAccount.sourceAliases || []), ...(current.sourceAliases || [])])),
          updatedAt: new Date().toISOString(),
        };
      });

      Object.entries(imported.accountState || {}).forEach(([accountNumber, importedState]) => {
        const target = next.accountState[accountNumber] || {
          visited: {},
          compliance: {},
          survey: {},
          objectives: {},
          notes: [],
          voids: { chain: {}, scaleUp: {}, perfectLaunch: {} },
          distro: {},
          pricing: {},
          eliteTasks: {},
          history: [],
        };
        target.visited = target.visited || {};
        target.compliance = target.compliance || {};
        target.survey = target.survey || {};
        target.objectives = target.objectives || {};
        target.notes = target.notes || [];
        target.voids = target.voids || { chain: {}, scaleUp: {}, perfectLaunch: {} };
        target.distro = target.distro || {};
        target.pricing = target.pricing || {};
        target.eliteTasks = target.eliteTasks || {};
        target.history = target.history || [];

        mergeObject(target.visited, importedState.visited);
        mergeObject(target.compliance, importedState.compliance);
        mergeObject(target.survey, importedState.survey);
        mergeObject(target.objectives, importedState.objectives);
        ["chain", "scaleUp", "perfectLaunch"].forEach((bucket) => {
          target.voids[bucket] = target.voids[bucket] || {};
          Object.entries(((importedState.voids || {})[bucket]) || {}).forEach(([sku, item]) => {
            target.voids[bucket][sku] = { ...(target.voids[bucket][sku] || {}), ...item };
          });
        });

        const knownNotes = new Set(target.notes.map((note) => note.id));
        (importedState.notes || []).forEach((note) => {
          if (!knownNotes.has(note.id)) target.notes.push(note);
        });
        next.accountState[accountNumber] = target;
      });

      next.route = next.route || { days: {}, frequency: {}, lastVisit: {} };
      if (imported.route && imported.route.days) next.route.days = imported.route.days;
      next.route.frequency = { ...(next.route.frequency || {}), ...((imported.route || {}).frequency || {}) };
      next.route.lastVisit = { ...(next.route.lastVisit || {}), ...((imported.route || {}).lastVisit || {}) };

      const existingActivity = new Set((next.activity || []).map((item) => item.id));
      next.activity = [
        ...((imported.activity || []).filter((item) => !existingActivity.has(item.id))),
        ...(next.activity || []),
      ].slice(0, 1000);
      next.summaries = { ...(next.summaries || {}), ...((imported.summaries || {})) };
    });
  }

  function activityScreen(state, ui) {
    const summary = ui.summaryText || generateSummary(state, ui);
    syncDailySummarySnapshot(state, ui, summary);
    const weeklyPrep = generateWeeklyPrep(state);
    const snapshots = summarySnapshots(state);
    return `${utilityHero("Activity", "Daily summary and route log.")}
      <div class="glass-shell glass-shell--floating account-shell utility-shell activity-shell">
      <section class="content-stack account-stack" data-scroll-key="screen:activity">
        ${dayTabs(ui)}
        ${accountSectionCard("daySummary", "End of Day Summary", `
          <textarea class="summary-box" readonly>${u.escapeHtml(summary)}</textarea>
          <button class="btn btn--primary btn--full" data-action="copy-summary">Copy Summary</button>
        `, false, "", { collapsible: false })}
        ${accountSectionCard("weeklyPrep", "Weekly 1-on-1 Prep", `
          <textarea class="summary-box summary-box--short" readonly>${u.escapeHtml(weeklyPrep)}</textarea>
          <button class="btn btn--ghost btn--full" data-action="copy-weekly">Copy Weekly Prep</button>
        `, sectionCollapsed(ui, "weeklyPrep", true))}
        ${accountSectionCard("summaryArchive", "Summary Archive", `
          ${snapshots.map((item) => `<div class="summary-snapshot">
            <b>${u.escapeHtml(u.formatDate(item.dateKey))} ${u.escapeHtml(u.DAY_LABELS[item.day] || item.day)}</b>
            <p>${u.escapeHtml((item.text || "").split("\n").slice(0, 3).join(" "))}</p>
          </div>`).join("") || `<div class="empty">Daily summaries will appear here as you view Activity.</div>`}
        `, sectionCollapsed(ui, "summaryArchive", true))}
        ${accountSectionCard("activityLog", "Activity", `
          ${(state.activity || []).slice(0, 40).map((item) => `<div class="activity-row">
            <b>${u.escapeHtml(item.label)}</b>
            <span>${u.escapeHtml(item.detail || item.accountNumber || "")}</span>
          </div>`).join("") || `<div class="empty">No activity yet.</div>`}
        `, sectionCollapsed(ui, "activityLog", true))}
      </section>
      ${bottomNav("activity")}
      </div>`;
  }

  function moreScreen(state, ui) {
    const preview = ui.importPreview;
    const settings = ui.settings || {};
    const collapsed = ui.collapsedPanels || {};
    return `${utilityHero("More", "Settings, backup, and route tools.")}
      <div class="glass-shell glass-shell--floating account-shell utility-shell more-shell">
      <section class="content-stack account-stack" data-scroll-key="screen:more">
        ${accountSectionCard("settings", "Settings Defaults", `
          <div class="settings-grid">
            <label class="field-label">Accent
              <select class="field-input" data-action="setting" data-field="accent">
                ${ACCENT_OPTIONS.map(([value, label]) => `<option value="${value}" ${settings.accent === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
            <label class="field-label">Glass
              <select class="field-input" data-action="setting" data-field="glass">
                ${GLASS_OPTIONS.map(([value, label]) => `<option value="${value}" ${settings.glass === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
          </div>
          <label class="toggle-row">
            <span><b>Dark Mode</b><small>Default remains off for Alpenglow clarity.</small></span>
            <input type="checkbox" data-action="setting-check" data-field="darkMode" ${settings.darkMode ? "checked" : ""}>
          </label>
        `, collapsed.settings)}
        ${accountSectionCard("notesShortcut", "Structured Notes", `
          <button class="btn btn--ghost btn--full" data-action="open-notes-index">Open Notes Timeline</button>
        `, collapsed.notesShortcut)}
        ${routeManager(state, ui)}
        ${accountSectionCard("legacyImport", "Legacy v0.6 Import", `
          <p class="t-sub">Import legacy JSON backups into the new account-number data model.</p>
          <input class="field-input" type="file" accept="application/json,.json" data-action="legacy-import">
          ${preview ? `<pre class="import-preview">${u.escapeHtml(JSON.stringify(preview.report, null, 2))}</pre><button class="btn btn--primary btn--full" data-action="apply-import">Apply Import</button>` : ""}
        `, collapsed.legacyImport)}
        ${accountSectionCard("backups", "Backups", `
          <button class="btn btn--ghost btn--full" data-action="quick-backup">Download Quick JSON</button>
          <button class="btn btn--primary btn--full" data-action="full-backup">Download Full ZIP</button>
          <p class="t-sub">Full ZIP includes app data plus saved photo and voice note files.</p>
        `, collapsed.backups)}
        <button class="btn btn--danger btn--full" data-action="reset-seed">Reset Local App Data</button>
      </section>
      ${bottomNav("more")}
      </div>`;
  }

  function routeManager(state, ui) {
    const day = u.DAY_ORDER.includes(ui.routeEditorDay) ? ui.routeEditorDay : ui.selectedDay;
    const accounts = select.accountsForDay(state, day);
    return accountSectionCard("routeManager", "Route Editor", `
      <p class="t-sub">Edit any day without changing the active route view.</p>
      <div class="route-editor-control">
        ${routeEditorTabs({ ...ui, routeEditorDay: day })}
      </div>
      ${accounts.map((accountNumber, index) => {
        const account = state.accounts[accountNumber] || {};
        return `<div class="route-manager-row">
          <div class="route-manager-head">
            <span class="route-position">${index + 1}</span>
            <div>
              <b>${u.escapeHtml(u.accountName(account))}</b>
              <small>${u.escapeHtml(u.accountSubtitle(account))}</small>
            </div>
          </div>
          <label class="field-label">Nickname
            <input class="field-input" data-action="route-nickname" data-account="${u.escapeHtml(accountNumber)}" value="${u.escapeHtml(account.nickname || "")}" placeholder="${u.escapeHtml(account.name || "")}">
          </label>
          <div class="route-manager-controls">
            <label class="field-label">Frequency
              <select class="field-input" data-action="route-frequency" data-account="${u.escapeHtml(accountNumber)}">
                ${FREQUENCY_OPTIONS.map((value) => `<option ${((account.frequency || "Weekly") === value) ? "selected" : ""}>${value}</option>`).join("")}
              </select>
            </label>
            <label class="field-label">Day
              <select class="field-input" data-action="route-day" data-account="${u.escapeHtml(accountNumber)}" data-from="${day}">
                ${u.DAY_ORDER.map((dayKey) => `<option value="${dayKey}" ${dayKey === day ? "selected" : ""}>${u.DAY_LABELS[dayKey]}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="button-row">
            <button class="btn btn--ghost" data-action="route-up" data-account="${u.escapeHtml(accountNumber)}" ${index === 0 ? "disabled" : ""}>Move Up</button>
            <button class="btn btn--ghost" data-action="route-down" data-account="${u.escapeHtml(accountNumber)}" ${index === accounts.length - 1 ? "disabled" : ""}>Move Down</button>
          </div>
        </div>`;
      }).join("") || `<div class="empty">No accounts assigned to this day.</div>`}
    `, sectionCollapsed(ui, "routeManager", true));
  }

  function notesIndexScreen(state) {
    const notes = Object.entries(state.accountState || {}).flatMap(([accountNumber, accountState]) => {
      const account = state.accounts[accountNumber] || {};
      return (accountState.notes || []).map((note) => ({ ...note, accountName: u.accountName(account) }));
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return `<header class="hero-band hero-band--utility">
        <button class="account-hero-back" data-action="back-more" aria-label="Back to More">${iconSvg("back")}</button>
        <div class="account-hero__copy">
          <div class="hero-band__eyebrow">Route 508</div>
          <h1 class="hero-band__title">Structured Notes</h1>
          <p class="hero-band__sub">${notes.length} notes</p>
        </div>
      </header>
      <div class="glass-shell glass-shell--floating account-shell utility-shell">
      <section class="content-stack account-stack" data-scroll-key="screen:notes-index">
        ${accountSectionCard("notesIndex", "Notes Timeline", `
          ${notes.map((note) => `<div class="note-item">
            <div class="row-spread"><b>${u.escapeHtml(note.accountName)}</b><span>${u.escapeHtml(note.type)}</span></div>
          ${note.followUpDate ? `<div class="t-tiny">Follow-up ${u.formatDate(note.followUpDate)}</div>` : ""}
          <p>${u.escapeHtml(note.body)}</p>
          ${(note.attachments || []).length ? `<div class="attachment-list">${note.attachments.map((item) => `<span>${u.escapeHtml(item.kind)}: ${u.escapeHtml(item.name)}</span>`).join("")}</div>` : ""}
        </div>`).join("") || `<div class="empty">No structured notes yet.</div>`}
        `, false, "", { collapsible: false })}
      </section>
      ${bottomNav("more")}
      </div>`;
  }

  function render() {
    if (searchRenderTimer) {
      clearTimeout(searchRenderTimer);
      searchRenderTimer = 0;
    }
    const oldScrollPanel = root.querySelector("[data-scroll-key]");
    if (oldScrollPanel && oldScrollPanel.dataset.scrollKey) {
      scrollMemory[oldScrollPanel.dataset.scrollKey] = oldScrollPanel.scrollTop;
    }
    const state = store.getState();
    const ui = store.getUi();
    applyTheme(ui.settings);
    const screen = ui.selectedAccount ? "account" : ui.screen;
    const html = screen === "accounts" ? accountsScreen(state, ui)
      : screen === "account" ? accountScreen(state, ui)
      : screen === "activity" ? activityScreen(state, ui)
      : screen === "notesIndex" ? notesIndexScreen(state, ui)
      : screen === "more" ? moreScreen(state, ui)
      : dashboard(state, ui);
    root.innerHTML = ["dashboard", "accounts", "account", "activity", "more", "notesIndex"].includes(screen)
      ? `<main class="page page--with-hero">${html}</main>`
      : `<main class="page"><div class="glass-shell">${html}</div></main>`;
    const nextScrollPanel = root.querySelector("[data-scroll-key]");
    if (nextScrollPanel && nextScrollPanel.dataset.scrollKey in scrollMemory) {
      nextScrollPanel.scrollTop = scrollMemory[nextScrollPanel.dataset.scrollKey];
      requestAnimationFrame(() => {
        nextScrollPanel.scrollTop = scrollMemory[nextScrollPanel.dataset.scrollKey];
      });
    }
  }

  function updateDraft(patch) {
    store.setUi({ noteDraft: { ...store.getUi().noteDraft, ...patch } });
  }

  function updateUiDraft(key, patch) {
    const ui = store.getUi();
    store.setUi({ [key]: { ...(ui[key] || {}), ...patch } });
  }

  function makeUndoSnapshot(label) {
    return {
      label,
      state: u.clone(store.getState()),
      ui: u.clone(store.getUi()),
    };
  }

  function snapshotChanged(snapshot) {
    if (!snapshot) return false;
    return JSON.stringify(snapshot.state) !== JSON.stringify(store.getState())
      || JSON.stringify(snapshot.ui) !== JSON.stringify(store.getUi());
  }

  function commitUndoSnapshot(snapshot) {
    if (!snapshot || !snapshotChanged(snapshot)) return;
    undoSnapshot = snapshot;
    showUndoToast(snapshot.label);
  }

  function withUndo(label, callback) {
    const snapshot = makeUndoSnapshot(label);
    const result = callback();
    commitUndoSnapshot(snapshot);
    return result;
  }

  function withDeferredUndo(key, label, callback) {
    deferredUndo[key] = deferredUndo[key] || { snapshot: makeUndoSnapshot(label), timer: 0 };
    callback();
    if (deferredUndo[key].timer) clearTimeout(deferredUndo[key].timer);
    deferredUndo[key].timer = setTimeout(() => {
      commitUndoSnapshot(deferredUndo[key].snapshot);
      delete deferredUndo[key];
    }, 900);
  }

  function ensureUndoToast() {
    let toast = document.querySelector(".undo-toast");
    if (toast) return toast;
    toast = document.createElement("div");
    toast.className = "undo-toast";
    toast.innerHTML = `<span class="undo-toast__text">Change saved.</span><button class="undo-toast__button" type="button">Undo</button>`;
    toast.querySelector(".undo-toast__button").addEventListener("click", () => {
      if (!undoSnapshot) return;
      const snapshot = undoSnapshot;
      undoSnapshot = null;
      hideUndoToast();
      store.replaceState(u.clone(snapshot.state));
      store.setUi(u.clone(snapshot.ui));
      applyTheme(store.getUi().settings);
      render();
    });
    document.body.appendChild(toast);
    return toast;
  }

  function showUndoToast(label) {
    const toast = ensureUndoToast();
    toast.querySelector(".undo-toast__text").textContent = `${label}.`;
    toast.classList.add("is-visible");
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndoToast, 6500);
  }

  function hideUndoToast() {
    const toast = document.querySelector(".undo-toast");
    if (toast) toast.classList.remove("is-visible");
    if (undoTimer) {
      clearTimeout(undoTimer);
      undoTimer = 0;
    }
  }

  function handleAction(target) {
    const action = target.dataset.action;
    if (!action) return;
    const state = store.getState();
    const ui = store.getUi();
    const undoBefore = UNDO_ACTION_LABELS[action] ? makeUndoSnapshot(UNDO_ACTION_LABELS[action]) : null;
    if (action === "nav") store.setUi({ screen: target.dataset.screen, selectedAccount: "" });
    if (action === "day") store.setUi({ selectedDay: target.dataset.day });
    if (action === "route-editor-day") store.setUi({ routeEditorDay: target.dataset.day });
    if (action === "toggle-panel") togglePanel(ui, target.dataset.panel);
    if (action === "score-step") stepScoreboard(state, ui, target.dataset.field, Number(target.dataset.delta) || 0);
    if (action === "start-route") store.setUi({ screen: "accounts", accountFilter: "today" });
    if (action === "start-next-stop") openNextStop(state, ui);
    if (action === "filter") store.setUi({ accountFilter: target.dataset.filter });
    if (action === "open-account") store.setUi({ selectedAccount: target.dataset.account, accountTab: "today" });
    if (action === "back-accounts") store.setUi({ selectedAccount: "", screen: "accounts" });
    if (action === "account-tab") store.setUi({ accountTab: target.dataset.tab });
    if (action === "toggle-void-view") store.setUi({ voidView: ui.voidView === "all" ? "open" : "all" });
    if (action === "toggle-distro-view") store.setUi({ distroView: ui.distroView === "all" ? "short" : "all" });
    if (action === "open-notes-index") store.setUi({ screen: "notesIndex", selectedAccount: "" });
    if (action === "back-more") store.setUi({ screen: "more", selectedAccount: "" });
    if (action === "mark-visited") markVisited(state, ui);
    if (action === "toggle-compliance") toggleCompliance(state, ui, target.dataset.check);
    if (action === "cycle-void") cycleVoid(state, ui, target.dataset.bucket, target.dataset.sku);
    if (action === "cycle-distro") cycleDistro(state, ui, target.dataset.sku);
    if (action === "delete-distro") deleteDistro(state, ui, target.dataset.sku);
    if (action === "add-distro") addDistro(state, ui);
    if (action === "add-elite-task") addEliteTask(state, ui);
    if (action === "cycle-elite-task") cycleEliteTask(state, ui, target.dataset.task);
    if (action === "save-pricing") savePricing(state, ui);
    if (action === "edit-pricing") editPricing(state, ui, target.dataset.price);
    if (action === "clear-pricing-draft") store.setUi({ pricingDraft: blankPricingDraft() });
    if (action === "delete-pricing") deletePricing(state, ui, target.dataset.price);
    if (action === "save-note") saveNote(state, ui);
    if (action === "copy-summary") navigator.clipboard?.writeText(generateSummary(state, ui));
    if (action === "copy-weekly") navigator.clipboard?.writeText(generateWeeklyPrep(state));
    if (action === "quick-backup") downloadJson(state);
    if (action === "full-backup") downloadFullBackup(state);
    if (action === "route-up") moveRouteAccount(state, ui, target.dataset.account, -1);
    if (action === "route-down") moveRouteAccount(state, ui, target.dataset.account, 1);
    if (action === "apply-import" && ui.importPreview) {
      if (!window.confirm("Merge this legacy backup into current Alpenglow data?")) return;
      mergeLegacyImport(ui.importPreview.seed);
      store.setUi({ importPreview: null, screen: "dashboard", selectedAccount: "" });
    }
    if (action === "reset-seed") {
      if (!window.confirm("Reset local Alpenglow data back to the seed file?")) return;
      store.resetToSeed();
      store.setUi({ importPreview: null, screen: "dashboard", selectedAccount: "" });
    }
    commitUndoSnapshot(undoBefore);
    render();
  }

  function togglePanel(ui, panel) {
    if (!panel) return;
    const collapsedPanels = { ...(ui.collapsedPanels || {}) };
    collapsedPanels[panel] = !collapsedPanels[panel];
    store.setUi({ collapsedPanels });
  }

  function stepScoreboard(state, ui, field, delta) {
    const allowed = new Set(["d", "p", "t", "r"]);
    if (!allowed.has(field) || !delta) return;
    store.update((next) => {
      next.summaries = next.summaries || {};
      next.summaries.legacy = next.summaries.legacy || {};
      next.summaries.legacy.scoreboard = next.summaries.legacy.scoreboard || {};
      const day = ui.selectedDay || u.currentDayKey();
      const score = next.summaries.legacy.scoreboard[day] || { d: 0, p: 0, t: 0, r: 0 };
      score[field] = Math.max(0, (Number(score[field]) || 0) + delta);
      next.summaries.legacy.scoreboard[day] = score;
      store.addActivity(next, u.makeActivity("scoreboardChanged", "", "Scoreboard changed", `${u.DAY_LABELS[day]} ${field.toUpperCase()} ${score[field]}`, u.todayKey()));
    });
  }

  function markVisited(state, ui) {
    const accountNumber = ui.selectedAccount;
    const weekKey = (state.summaries?.legacy?.weekKey) || "current";
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      accountState.visited[weekKey] = accountState.visited[weekKey] || {};
      accountState.visited[weekKey][ui.selectedDay] = { visited: true, visitedAt: new Date().toISOString() };
      store.addActivity(next, u.makeActivity("accountVisited", accountNumber, "Account visited", ui.selectedDay.toUpperCase(), u.todayKey()));
    });
  }

  function toggleCompliance(state, ui, key) {
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const item = accountState.compliance[key] || {};
      accountState.compliance[key] = item.done ? { done: false, doneAt: "" } : { done: true, doneAt: u.todayKey() };
      store.addActivity(next, u.makeActivity("complianceChanged", accountNumber, `${key} changed`, "", u.todayKey()));
    });
  }

  function cycleVoid(state, ui, bucket, sku) {
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const item = ((accountState.voids || {})[bucket] || {})[sku];
      if (!item) return;
      item.state = u.stateNext(item.state || "Open", u.VOID_STATES[bucket]);
      item.updatedAt = new Date().toISOString();
      store.addActivity(next, u.makeActivity("voidChanged", accountNumber, `${bucket} - ${item.state}`, sku, u.todayKey()));
    });
  }

  function cycleDistro(state, ui, sku) {
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const item = accountState.distro[sku];
      if (!item) return;
      item.state = u.stateNext(item.state || "Open", u.VOID_STATES.distro);
      item.soldInAt = item.state === "Sold In" ? u.todayKey() : "";
      item.updatedAt = new Date().toISOString();
      store.addActivity(next, u.makeActivity("distroChanged", accountNumber, `Distro ${item.state}`, sku, u.todayKey()));
    });
  }

  function addDistro(state, ui) {
    const accountNumber = ui.selectedAccount;
    const sku = String((ui.distroDraft || {}).sku || "").trim();
    if (!sku) return;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      accountState.distro[sku] = {
        ...(accountState.distro[sku] || {}),
        state: (accountState.distro[sku] || {}).state || "Open",
        source: "Manual",
        addedAt: (accountState.distro[sku] || {}).addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addActivity(next, u.makeActivity("distroAdded", accountNumber, "Distro SKU added", sku, u.todayKey()));
    });
    store.setUi({
      distroDraft: { sku: "" },
      distroView: "all",
      collapsedPanels: { ...(ui.collapsedPanels || {}), accountDistroAdd: true },
    });
  }

  function deleteDistro(state, ui, sku) {
    if (!window.confirm("Remove this manually added distro SKU?")) return;
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const item = accountState.distro[sku];
      if (!item || item.source !== "Manual") return;
      delete accountState.distro[sku];
      store.addActivity(next, u.makeActivity("distroDeleted", accountNumber, "Manual distro SKU removed", sku, u.todayKey()));
    });
  }

  function addEliteTask(state, ui) {
    const accountNumber = ui.selectedAccount;
    const draft = ui.eliteDraft || {};
    const title = String(draft.title || "").trim();
    if (!title) return;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const id = u.uid("elite");
      accountState.eliteTasks[id] = {
        id,
        title,
        detail: String(draft.detail || "").trim(),
        status: draft.status || "To Do",
        dueDate: draft.dueDate || "",
        source: "Manual",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addActivity(next, u.makeActivity("eliteTaskAdded", accountNumber, "Elite task added", title, u.todayKey()));
    });
    store.setUi({
      eliteDraft: { title: "", detail: "", status: "To Do", dueDate: "" },
      collapsedPanels: { ...(ui.collapsedPanels || {}), accountEliteAdd: true },
    });
  }

  function cycleEliteTask(state, ui, taskId) {
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const task = accountState.eliteTasks[taskId];
      if (!task) return;
      task.status = u.stateNext(task.status || "To Do", ELITE_STATUSES);
      task.updatedAt = new Date().toISOString();
      store.addActivity(next, u.makeActivity("eliteTaskChanged", accountNumber, `Elite task ${task.status}`, task.title, u.todayKey()));
    });
  }

  function savePricing(state, ui) {
    const accountNumber = ui.selectedAccount;
    const draft = ui.pricingDraft || {};
    const sku = String(draft.sku || "").trim();
    if (!sku) return;
    const id = draft.id || u.uid("price");
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      accountState.pricing[id] = {
        id,
        sku,
        caseCost: draft.caseCost || "",
        unitsPerCase: draft.unitsPerCase || "",
        retailPrice: draft.retailPrice || "",
        retailUnitQty: draft.retailUnitQty || "1",
        targetMargin: draft.targetMargin || "",
        twoForPrice: draft.twoForPrice || "",
        competitorSku: draft.competitorSku || "",
        competitorPrice: draft.competitorPrice || "",
        notes: String(draft.notes || "").trim(),
        createdAt: (accountState.pricing[id] || {}).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addActivity(next, u.makeActivity("pricingChanged", accountNumber, draft.id ? "Pricing updated" : "Pricing SKU added", sku, u.todayKey()));
    });
    store.setUi({ pricingDraft: blankPricingDraft() });
  }

  function editPricing(state, ui, pricingId) {
    const item = (((state.accountState || {})[ui.selectedAccount] || {}).pricing || {})[pricingId];
    if (!item) return;
    store.setUi({ pricingDraft: { ...blankPricingDraft(), ...item } });
  }

  function deletePricing(state, ui, pricingId) {
    if (!window.confirm("Delete this local pricing tracker item?")) return;
    const accountNumber = ui.selectedAccount;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      const item = accountState.pricing[pricingId];
      if (!item) return;
      delete accountState.pricing[pricingId];
      store.addActivity(next, u.makeActivity("pricingDeleted", accountNumber, "Pricing item deleted", item.sku || "", u.todayKey()));
    });
    store.setUi({ pricingDraft: blankPricingDraft() });
  }

  function saveNote(state, ui) {
    const accountNumber = ui.selectedAccount;
    const draft = ui.noteDraft || {};
    if (!String(draft.body || "").trim()) return;
    store.update((next) => {
      const accountState = ensureAccountState(next, accountNumber);
      accountState.notes.push({
        id: u.uid("note"),
        accountNumber,
        type: draft.type || "General",
        body: draft.body.trim(),
        followUpDate: draft.followUpDate || "",
        attachments: draft.attachments || [],
        legacy: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      store.addActivity(next, u.makeActivity("noteCreated", accountNumber, "Note created", draft.type || "General", u.todayKey()));
    });
    store.setUi({ noteDraft: { type: "General", body: "", followUpDate: "", attachments: [] } });
  }

  function downloadJson(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route508-alpenglow-quick-backup-${u.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFullBackup(state) {
    if (!media?.fullBackupZip) {
      downloadJson(state);
      return;
    }
    const blob = await media.fullBackupZip(state);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route508-alpenglow-full-backup-${u.todayKey()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.matches("select,input,textarea,label")) return;
    const fileAction = FILE_ACTIONS.has(target.dataset.action);
    if (!fileAction) {
      event.preventDefault();
      handleAction(target);
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.action === "sort") {
      store.setUi({ accountSort: target.value });
      renderAccountRowsOnly();
      return;
    }
    if (target.dataset.action === "setting") {
      withUndo("Settings changed", () => updateSettings({ [target.dataset.field]: target.value }));
      applyTheme(store.getUi().settings);
      return;
    }
    if (target.dataset.action === "setting-check") {
      withUndo("Settings changed", () => updateSettings({ [target.dataset.field]: target.checked }));
      applyTheme(store.getUi().settings);
      return;
    }
    if (target.dataset.action === "route-frequency") {
      withUndo("Route frequency changed", () => updateRouteAccount(target.dataset.account, { frequency: target.value }));
      requestAnimationFrame(render);
      return;
    }
    if (target.dataset.action === "route-day") {
      withUndo("Route day changed", () => changeRouteDay(target.dataset.account, target.dataset.from, target.value));
      requestAnimationFrame(render);
      return;
    }
    if (target.dataset.action === "note-type") {
      updateDraft({ type: target.value });
      return;
    }
    if (target.dataset.action === "note-followup") {
      updateDraft({ followUpDate: target.value });
      return;
    }
    if (target.dataset.action === "attach-photo" && target.files?.[0]) {
      attachMedia(target.files[0], "photo");
      return;
    }
    if (target.dataset.action === "attach-voice" && target.files?.[0]) {
      attachMedia(target.files[0], "voice");
      return;
    }
    if (target.dataset.action === "elite-draft") {
      updateUiDraft("eliteDraft", { [target.dataset.field]: target.value });
      return;
    }
    if (target.dataset.action === "pricing-draft") {
      updateUiDraft("pricingDraft", { [target.dataset.field]: target.value });
      return;
    }
    if (target.dataset.action === "legacy-import" && target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const legacy = JSON.parse(reader.result);
          store.setUi({ importPreview: window.AlpenglowMigration.migrateLegacyV06(legacy) });
          render();
        } catch (error) {
          store.setUi({ importPreview: { report: { error: error.message } } });
          render();
        }
      };
      reader.readAsText(target.files[0]);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.action === "account-search") {
      if (searchRenderTimer) clearTimeout(searchRenderTimer);
      store.setUi({ accountSearch: target.value });
      searchRenderTimer = setTimeout(() => {
        searchRenderTimer = 0;
        renderAccountRowsOnly();
      }, 90);
      return;
    }
    if (target.dataset.action === "note-body") updateDraft({ body: target.value });
    if (target.dataset.action === "distro-draft") updateUiDraft("distroDraft", { [target.dataset.field]: target.value });
    if (target.dataset.action === "elite-draft") updateUiDraft("eliteDraft", { [target.dataset.field]: target.value });
    if (target.dataset.action === "pricing-draft") updateUiDraft("pricingDraft", { [target.dataset.field]: target.value });
    if (target.dataset.action === "objective") {
      const ui = store.getUi();
      withDeferredUndo(`objective:${ui.selectedAccount}`, "Objective changed", () => {
        store.update((next) => {
          next.accountState[ui.selectedAccount].objectives.current = target.value;
        }, { defer: true });
      });
    }
    if (target.dataset.action === "account-field") {
      const ui = store.getUi();
      withDeferredUndo(`account-field:${ui.selectedAccount}:${target.dataset.field}`, "Account field changed", () => {
        store.update((next) => {
          next.accounts[ui.selectedAccount][target.dataset.field] = target.value;
        }, { defer: true });
      });
    }
    if (target.dataset.action === "route-nickname") {
      withDeferredUndo(`route-nickname:${target.dataset.account}`, "Route nickname changed", () => {
        updateRouteAccount(target.dataset.account, { nickname: target.value }, true);
      });
    }
  });

  function updateSettings(patch) {
    const ui = store.getUi();
    store.setUi({ settings: { ...(ui.settings || {}), ...patch } });
  }

  function updateRouteAccount(accountNumber, patch, defer) {
    store.update((next) => {
      const account = next.accounts[accountNumber];
      if (!account) return;
      Object.assign(account, patch, { updatedAt: new Date().toISOString() });
    }, defer ? { defer: true } : undefined);
  }

  function moveRouteAccount(state, ui, accountNumber, direction) {
    const day = u.DAY_ORDER.includes(ui.routeEditorDay) ? ui.routeEditorDay : ui.selectedDay;
    const route = select.accountsForDay(state, day);
    const index = route.indexOf(accountNumber);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= route.length) return;
    store.update((next) => {
      const list = next.route.days[day];
      const [item] = list.splice(index, 1);
      list.splice(nextIndex, 0, item);
      store.addActivity(next, u.makeActivity("routeOrderChanged", accountNumber, "Route order changed", u.DAY_LABELS[day], u.todayKey()));
    });
  }

  function changeRouteDay(accountNumber, fromDay, toDay) {
    if (!u.DAY_ORDER.includes(fromDay) || !u.DAY_ORDER.includes(toDay) || fromDay === toDay) return;
    store.update((next) => {
      const fromList = next.route.days[fromDay] || [];
      const toList = next.route.days[toDay] || [];
      next.route.days[fromDay] = fromList.filter((value) => value !== accountNumber);
      if (!toList.includes(accountNumber)) toList.push(accountNumber);
      next.route.days[toDay] = toList;
      store.addActivity(next, u.makeActivity("routeDayChanged", accountNumber, "Route day changed", `${u.DAY_LABELS[fromDay]} to ${u.DAY_LABELS[toDay]}`, u.todayKey()));
    });
  }

  async function attachMedia(file, kind) {
    try {
      if (!media?.saveFile) throw new Error("Media storage is not loaded.");
      const attachment = await media.saveFile(file, kind);
      const noteDraft = store.getUi().noteDraft || {};
      store.setUi({ noteDraft: { ...noteDraft, attachments: [...(noteDraft.attachments || []), attachment] } });
    } catch (error) {
      const noteDraft = store.getUi().noteDraft || {};
      store.setUi({
        noteDraft: {
          ...noteDraft,
          body: `${noteDraft.body || ""}\n[${kind} attachment could not be saved: ${error.message}]`.trim(),
        },
      });
    }
    render();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  registerServiceWorker();
  render();
}());
