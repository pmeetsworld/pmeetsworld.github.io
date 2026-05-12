/* Alpenglow local state store. */
(function () {
  "use strict";

  const STORAGE_KEY = "route508.alpenglow.v0.10.state";
  const UI_KEY = "route508.alpenglow.v0.10.ui";
  const u = window.AlpenglowUtils;

  function baseState() {
    const seed = window.ALPENGLOW_SEED;
    if (!seed) throw new Error("Alpenglow seed data is missing.");
    return u.clone(seed);
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  let saveTimer = 0;

  function saveStateNow() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    saveJson(STORAGE_KEY, state);
  }

  function queueStateSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveStateNow, 250);
  }

  function loadState() {
    const saved = loadJson(STORAGE_KEY, null);
    if (!saved || saved.schemaVersion !== window.ALPENGLOW_SEED.schemaVersion) {
      const fresh = baseState();
      saveJson(STORAGE_KEY, fresh);
      return fresh;
    }
    return saved;
  }

  function defaultUi() {
    return {
      screen: "dashboard",
      selectedDay: u.currentDayKey(),
      selectedAccount: "",
      accountTab: "today",
      accountFilter: "today",
      accountSort: "route",
      accountSearch: "",
      routeEditorDay: u.currentDayKey(),
      collapsedPanels: {
        settings: true,
        notesShortcut: true,
        legacyImport: true,
        backups: true,
        sellThisByThen: true,
        accountCompliance: true,
        accountDistro: true,
        accountDistroAdd: true,
        accountElite: true,
        accountEliteAdd: true,
        accountInfo: true,
        accountPricing: true,
        accountNotesTimeline: true,
        weeklyPrep: true,
        summaryArchive: true,
        activityLog: true,
        routeManager: true,
      },
      voidView: "open",
      distroView: "short",
      noteDraft: { type: "General", body: "", followUpDate: "", attachments: [] },
      distroDraft: { sku: "" },
      eliteDraft: { title: "", detail: "", status: "To Do", dueDate: "" },
      settings: { accent: "amber", glass: "medium", darkMode: false },
      pricingDraft: {
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
      },
      summaryText: "",
      importPreview: null,
    };
  }

  function loadUi() {
    const defaults = defaultUi();
    const saved = loadJson(UI_KEY, {});
    const selectedDay = u.DAY_ORDER.includes(saved.selectedDay) ? saved.selectedDay : defaults.selectedDay;
    return {
      ...defaults,
      ...saved,
      screen: "dashboard",
      selectedAccount: "",
      selectedDay,
      routeEditorDay: u.DAY_ORDER.includes(saved.routeEditorDay) ? saved.routeEditorDay : selectedDay,
      collapsedPanels: { ...defaults.collapsedPanels, ...(saved.collapsedPanels || {}) },
      noteDraft: { ...defaults.noteDraft, ...(saved.noteDraft || {}), attachments: ((saved.noteDraft || {}).attachments || []) },
      distroDraft: { ...defaults.distroDraft, ...(saved.distroDraft || {}) },
      eliteDraft: { ...defaults.eliteDraft, ...(saved.eliteDraft || {}) },
      settings: { ...defaults.settings, ...(saved.settings || {}) },
      pricingDraft: { ...defaults.pricingDraft, ...(saved.pricingDraft || {}) },
      accountSearch: saved.accountSearch || "",
    };
  }

  let state = loadState();
  let ui = loadUi();

  function getState() {
    return state;
  }

  function getUi() {
    return ui;
  }

  function setUi(patch) {
    ui = { ...ui, ...patch };
    saveJson(UI_KEY, ui);
  }

  function update(mutator, options) {
    mutator(state);
    if (options && options.defer) {
      queueStateSave();
      return;
    }
    saveStateNow();
  }

  function resetToSeed() {
    state = baseState();
    saveStateNow();
  }

  function replaceState(nextState) {
    state = nextState;
    saveStateNow();
  }

  function addActivity(next, activity) {
    next.activity = [activity, ...(next.activity || [])].slice(0, 1000);
  }

  window.AlpenglowStore = {
    getState,
    getUi,
    setUi,
    update,
    resetToSeed,
    replaceState,
    addActivity,
    flush: saveStateNow,
  };

  window.addEventListener("beforeunload", saveStateNow);
}());
