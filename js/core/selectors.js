/* Alpenglow read-only state selectors. */
(function () {
  "use strict";

  const u = window.AlpenglowUtils;

  function accountsForDay(state, day) {
    return ((state.route || {}).days || {})[day] || [];
  }

  function accountState(state, accountNumber) {
    return ((state.accountState || {})[accountNumber]) || {};
  }

  function isVisited(state, accountNumber, day) {
    const weekKey = (state.summaries && state.summaries.legacy && state.summaries.legacy.weekKey) || "current";
    return !!((((accountState(state, accountNumber).visited || {})[weekKey] || {})[day] || {}).visited);
  }

  function opportunityCount(state, accountNumber, onlyOpen) {
    const account = accountState(state, accountNumber);
    const voids = account.voids || {};
    const buckets = [voids.chain, voids.scaleUp, voids.perfectLaunch];
    return buckets.reduce((sum, bucket) => {
      const records = Object.values(bucket || {});
      return sum + (onlyOpen ? records.filter((item) => (item.state || "Open") === "Open").length : records.length);
    }, 0);
  }

  function complianceDone(state, accountNumber, key) {
    return !!(((accountState(state, accountNumber).compliance || {})[key] || {}).done);
  }

  function routeProgress(state, day) {
    const accounts = accountsForDay(state, day);
    const visited = accounts.filter((accountNumber) => isVisited(state, accountNumber, day)).length;
    return {
      total: accounts.length,
      visited,
      pct: accounts.length ? Math.round((visited / accounts.length) * 100) : 0,
    };
  }

  function distroProgress(state, day) {
    const accounts = accountsForDay(state, day);
    let total = 0;
    let sold = 0;
    accounts.forEach((accountNumber) => {
      Object.values(accountState(state, accountNumber).distro || {}).forEach((item) => {
        total += 1;
        if (item.state === "Sold In") sold += 1;
      });
    });
    return {
      total,
      sold,
      pct: total ? Math.round((sold / total) * 100) : 0,
    };
  }

  function routeHealth(state, day) {
    const progress = routeProgress(state, day);
    const distro = distroProgress(state, day);
    const openOpps = accountsForDay(state, day).reduce((sum, accountNumber) => sum + opportunityCount(state, accountNumber, true), 0);
    const visitScore = progress.pct;
    const distroScore = distro.total ? distro.pct : 100;
    const oppPenalty = Math.min(35, Math.round(openOpps / Math.max(1, progress.total)));
    return Math.max(0, Math.min(100, Math.round((visitScore * 0.55) + (distroScore * 0.25) + 20 - oppPenalty)));
  }

  function scoreboard(state, day) {
    const sc = (((state.summaries || {}).legacy || {}).scoreboard || {})[day] || {};
    return {
      displays: sc.d || 0,
      pods: sc.p || 0,
      taps: sc.t || 0,
      resets: sc.r || 0,
    };
  }

  function filteredAccounts(state, ui) {
    let numbers = Object.keys(state.accounts || {});
    if (ui.accountFilter === "today") numbers = accountsForDay(state, ui.selectedDay);
    if (ui.accountFilter === "priority") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("Priority"));
    if (ui.accountFilter === "new") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("New"));
    if (ui.accountFilter === "notDone") numbers = accountsForDay(state, ui.selectedDay).filter((n) => !isVisited(state, n, ui.selectedDay));
    if (ui.accountFilter === "dsd") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("DSD"));
    if (ui.accountFilter === "chain") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("Chain") || state.accounts[n].type === "chain");
    if (ui.accountFilter === "independent") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("Independent") || state.accounts[n].type === "independent");
    if (ui.accountFilter === "onPremise") numbers = numbers.filter((n) => (state.accounts[n].tags || []).includes("On-Premise") || state.accounts[n].type === "onPremise");

    const query = String(ui.accountSearch || "").trim().toLowerCase();
    if (query) {
      numbers = numbers.filter((n) => {
        const account = state.accounts[n] || {};
        return [
          account.accountNumber,
          account.name,
          account.nickname,
          account.chainBanner,
          account.chainStoreNumber,
          account.type,
          ...(account.tags || []),
          ...(account.sourceAliases || []),
        ].filter(Boolean).join(" ").toLowerCase().includes(query);
      });
    }

    const dayOrder = new Map(accountsForDay(state, ui.selectedDay).map((accountNumber, index) => [accountNumber, index]));
    return numbers
      .map((accountNumber) => state.accounts[accountNumber])
      .filter(Boolean)
      .sort((a, b) => {
        if (ui.accountSort === "route") return (dayOrder.get(a.accountNumber) ?? 999) - (dayOrder.get(b.accountNumber) ?? 999);
        if (ui.accountSort === "opps") return opportunityCount(state, b.accountNumber, true) - opportunityCount(state, a.accountNumber, true);
        if (ui.accountSort === "totalOpps") return opportunityCount(state, b.accountNumber, false) - opportunityCount(state, a.accountNumber, false);
        if (ui.accountSort === "survey") return Number(complianceDone(state, a.accountNumber, "merchSurvey")) - Number(complianceDone(state, b.accountNumber, "merchSurvey"));
        if (ui.accountSort === "outOfCode") return Number(!complianceDone(state, b.accountNumber, "outOfCode")) - Number(!complianceDone(state, a.accountNumber, "outOfCode"));
        if (ui.accountSort === "type") return (a.type || "").localeCompare(b.type || "") || u.accountName(a).localeCompare(u.accountName(b));
        if (ui.accountSort === "lastVisit") {
          const av = String((state.route.lastVisit || {})[a.accountNumber] || "");
          const bv = String((state.route.lastVisit || {})[b.accountNumber] || "");
          if (!av && bv) return 1;
          if (av && !bv) return -1;
          return bv.localeCompare(av);
        }
        return u.accountName(a).localeCompare(u.accountName(b));
      });
  }

  window.AlpenglowSelectors = {
    accountsForDay,
    accountState,
    isVisited,
    opportunityCount,
    complianceDone,
    routeProgress,
    distroProgress,
    routeHealth,
    scoreboard,
    filteredAccounts,
  };
}());
