/* Alpenglow v0.10 legacy migration helpers. */
(function () {
  const SCHEMA_VERSION = 10;
  const APP_VERSION = "Alpenglow v0.10";

  const TYPE_MAP = { C: "chain", I: "independent", O: "onPremise" };
  const TYPE_TAGS = { chain: "Chain", independent: "Independent", onPremise: "On-Premise" };
  const CHECK_MAP = { tags: "priceTags", ooc: "outOfCode", reb: "rebates", pocm: "pocm" };
  const CV_STATE = ["Open", "True Void", "Not in Set", "In Account", "Sold In"];
  const SU_STATE = ["Open", "Not in Set", "Slow Mover", "Pitched", "Sold In"];
  const PL_STATE = ["Open", "Not in Set", "Pitched", "POD Placed"];

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function accountNumberFromLegacyId(legacyId) {
    return String(legacyId || "").replace("#", "").trim();
  }

  function normalizeText(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/[^A-Z0-9 ]+/g, " ")
      .replace(/\b(THE|STORE|INC|LLC|GI|NE|NO|NUMBER)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function chainBanner(name) {
    const n = normalizeText(name);
    if (n.includes("CASEY")) return "Casey's";
    if (n.includes("PUMP AND PANTRY") || n.includes("P AND P") || /\bP P\b/.test(n)) return "Pump & Pantry";
    if (n.includes("WALMART")) return "Walmart";
    if (n.includes("FAMILY DOLLAR")) return "Family Dollar";
    if (n.includes("KWIK STOP")) return "Kwik Stop";
    if (n.includes("FILL N CHILL")) return "Fill N Chill";
    return "";
  }

  function chainStoreNumber(name) {
    const text = String(name || "");
    const hashMatch = text.match(/#\s*(\d{1,5})/);
    if (hashMatch) return hashMatch[1];
    if (!chainBanner(text)) return "";
    const numbers = text.match(/\b(\d{1,5})\b/g);
    return numbers && numbers.length ? numbers[numbers.length - 1] : "";
  }

  function initialState() {
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

  function makeActivity(type, accountNumber, label, detail, dateKey) {
    const safe = [type, accountNumber || "", label || "", detail || "", dateKey || ""]
      .join("|")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80);
    return {
      id: safe,
      type,
      accountNumber,
      label,
      detail: detail || "",
      dateKey: dateKey || todayKey(),
      createdAt: new Date().toISOString(),
    };
  }

  function migrateLegacyV06(legacyBackup, options) {
    const importDate = (options && options.importDate) || todayKey();
    if (!legacyBackup || !Array.isArray(legacyBackup.roster) || !legacyBackup.persist) {
      throw new Error("Not a recognized Route 508 legacy backup.");
    }

    const accounts = {};
    const accountState = {};
    const route = {
      days: { mon: [], tue: [], wed: [], thu: [], fri: [] },
      frequency: {},
      lastVisit: {},
    };
    const activity = [];
    const report = {
      accountsImported: 0,
      notesImported: 0,
      complianceImported: 0,
      surveysImported: 0,
      voidStatesImported: 0,
      visitedImported: 0,
      skipped: [],
    };

    legacyBackup.roster.forEach((legacyAccount) => {
      const accountNumber = accountNumberFromLegacyId(legacyAccount.id);
      const accountType = TYPE_MAP[legacyAccount.type] || "unknown";
      const banner = chainBanner(legacyAccount.name);
      const tags = [];
      if (TYPE_TAGS[accountType]) tags.push(TYPE_TAGS[accountType]);
      if (banner && !tags.includes("Chain")) tags.push("Chain");

      accounts[accountNumber] = {
        accountNumber,
        legacyId: legacyAccount.id,
        name: legacyAccount.name || "",
        nickname: legacyAccount.nick || "",
        chainBanner: banner,
        chainStoreNumber: chainStoreNumber(legacyAccount.name),
        type: accountType,
        tags: Array.from(new Set(tags)).sort(),
        address: "",
        buyer: "",
        phone: "",
        email: "",
        sourceAliases: Array.from(new Set([
          legacyAccount.name || "",
          legacyAccount.nick || "",
          normalizeText(legacyAccount.name || ""),
        ].filter(Boolean))),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accountState[accountNumber] = initialState();
      route.frequency[accountNumber] = legacyAccount.freq || "W";
      if (legacyAccount.lastVisit) route.lastVisit[accountNumber] = legacyAccount.lastVisit;
      (legacyAccount.days || []).forEach((day) => {
        if (route.days[day]) route.days[day].push({
          order: legacyAccount.order && legacyAccount.order[day] !== undefined ? legacyAccount.order[day] : 999,
          accountNumber,
        });
      });
      report.accountsImported += 1;
    });

    Object.keys(route.days).forEach((day) => {
      route.days[day] = route.days[day]
        .sort((a, b) => a.order - b.order)
        .map((item) => item.accountNumber);
    });

    Object.entries(legacyBackup.persist.notes || {}).forEach(([legacyId, note]) => {
      const accountNumber = accountNumberFromLegacyId(legacyId);
      if (!accountState[accountNumber] || !String(note || "").trim()) return;
      accountState[accountNumber].notes.push({
        id: `legacy-note-${accountNumber}-${importDate}`,
        accountNumber,
        type: "Legacy Note",
        body: String(note).trim(),
        followUpDate: "",
        attachments: [],
        legacy: true,
        createdAt: `${importDate}T00:00:00.000Z`,
        updatedAt: `${importDate}T00:00:00.000Z`,
      });
      activity.push(makeActivity("noteImported", accountNumber, "Legacy note imported", "", importDate));
      report.notesImported += 1;
    });

    Object.entries(legacyBackup.persist.ds || {}).forEach(([key, doneAt]) => {
      const match = key.match(/^(#?[^_]+)_(tags|ooc|reb|pocm)$/);
      if (!match) return;
      const accountNumber = accountNumberFromLegacyId(match[1]);
      const checkKey = CHECK_MAP[match[2]];
      if (!accountState[accountNumber] || !checkKey) return;
      accountState[accountNumber].compliance[checkKey] = { done: true, doneAt };
      activity.push(makeActivity("complianceChanged", accountNumber, `${checkKey} checked`, "", doneAt));
      report.complianceImported += 1;
    });

    Object.entries(legacyBackup.persist.survey || {}).forEach(([legacyId, doneAt]) => {
      const accountNumber = accountNumberFromLegacyId(legacyId);
      if (!accountState[accountNumber]) return;
      accountState[accountNumber].compliance.merchSurvey = { done: true, doneAt };
      activity.push(makeActivity("surveyChanged", accountNumber, "Merch / space survey checked", "", doneAt));
      report.surveysImported += 1;
    });

    Object.entries(legacyBackup.persist.vs || {}).forEach(([legacyId, typedVoids]) => {
      const accountNumber = accountNumberFromLegacyId(legacyId);
      if (!accountState[accountNumber]) return;
      Object.entries(typedVoids.cv || {}).forEach(([sku, state]) => {
        accountState[accountNumber].voids.chain[sku] = {
          state: CV_STATE[state] || "Open",
          legacyState: state,
          source: "Legacy v0.6 Backup",
          lastPurchaseDate: "",
          lastPurchaseQty: "",
          updatedAt: new Date().toISOString(),
        };
        report.voidStatesImported += 1;
      });
      Object.entries(typedVoids.su || {}).forEach(([sku, state]) => {
        accountState[accountNumber].voids.scaleUp[sku] = {
          state: SU_STATE[state] || "Open",
          legacyState: state,
          priority: "",
          source: "Legacy v0.6 Backup",
          lastPurchaseDate: "",
          lastPurchaseQty: "",
          updatedAt: new Date().toISOString(),
        };
        report.voidStatesImported += 1;
      });
      Object.entries(typedVoids.pl || {}).forEach(([sku, state]) => {
        accountState[accountNumber].voids.perfectLaunch[sku] = {
          state: PL_STATE[state] || "Open",
          legacyState: state,
          source: "Legacy v0.6 Backup",
          lastPurchaseDate: "",
          lastPurchaseQty: "",
          updatedAt: new Date().toISOString(),
        };
        report.voidStatesImported += 1;
      });
    });

    Object.entries((legacyBackup.weekly && legacyBackup.weekly.done) || {}).forEach(([key, visited]) => {
      const match = key.match(/^(#?[^_]+)_([a-z]+)$/);
      if (!match || !visited) return;
      const accountNumber = accountNumberFromLegacyId(match[1]);
      const day = match[2];
      if (!accountState[accountNumber]) return;
      const weekKey = legacyBackup.weekKey || (legacyBackup.weekly && legacyBackup.weekly.weekKey) || "";
      if (!accountState[accountNumber].visited[weekKey]) accountState[accountNumber].visited[weekKey] = {};
      accountState[accountNumber].visited[weekKey][day] = {
        visited: true,
        visitedAt: new Date().toISOString(),
      };
      activity.push(makeActivity("accountVisited", accountNumber, "Visited from legacy backup", "", importDate));
      report.visitedImported += 1;
    });

    Object.entries((legacyBackup.weekly && legacyBackup.weekly.obj) || {}).forEach(([legacyId, objective]) => {
      const accountNumber = accountNumberFromLegacyId(legacyId);
      if (!accountState[accountNumber] || !String(objective || "").trim()) return;
      accountState[accountNumber].objectives[legacyBackup.weekKey || "legacy"] = String(objective).trim();
    });

    return {
      seed: {
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        generatedAt: new Date().toISOString(),
        importDate,
        settings: {
          backgroundImage: "alpenglow-mountain",
          accentColor: "amber",
          glassOpacity: "medium",
          darkMode: false,
        },
        accounts,
        route,
        accountState,
        activity,
        summaries: {
          legacy: {
            weekKey: legacyBackup.weekKey || (legacyBackup.weekly && legacyBackup.weekly.weekKey) || "",
            scoreboard: (legacyBackup.weekly && legacyBackup.weekly.sc) || {},
            lastweek: legacyBackup.lastweek || null,
          },
        },
        mediaManifest: { photos: {}, voice: {} },
      },
      report,
    };
  }

  window.AlpenglowMigration = {
    migrateLegacyV06,
    accountNumberFromLegacyId,
    normalizeText,
    chainBanner,
    chainStoreNumber,
  };
}());
