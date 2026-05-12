/* Alpenglow shared utilities. */
(function () {
  "use strict";

  const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri"];
  const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };
  const VOID_STATES = {
    chain: ["Open", "True Void", "Not in Set", "In Account", "Sold In"],
    scaleUp: ["Open", "Not in Set", "Slow Mover", "Pitched", "Sold In"],
    perfectLaunch: ["Open", "Not in Set", "Pitched", "POD Placed"],
    distro: ["Open", "Sold In"],
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function currentDayKey() {
    const day = new Date().getDay();
    return DAY_ORDER[Math.max(0, Math.min(4, day - 1))] || "mon";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function accountName(account) {
    return account?.nickname || account?.name || account?.accountNumber || "Unknown Account";
  }

  function accountSubtitle(account) {
    return [
      account?.accountNumber ? `#${account.accountNumber}` : "",
      account?.chainStoreNumber ? `Store ${account.chainStoreNumber}` : "",
      (account?.tags || []).join(", "),
    ].filter(Boolean).join(" - ");
  }

  function stateNext(current, states) {
    const list = states || [];
    const index = list.indexOf(current);
    return list[(index + 1) % list.length] || list[0] || current;
  }

  function openItems(records) {
    return Object.values(records || {}).filter((item) => (item.state || "Open") === "Open");
  }

  function objectCount(value) {
    return Object.keys(value || {}).length;
  }

  function formatDate(value) {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split("-");
      return `${month}/${day}/${year.slice(2)}`;
    }
    return text;
  }

  function makeActivity(type, accountNumber, label, detail, dateKey) {
    return {
      id: uid("act"),
      type,
      accountNumber: accountNumber || "",
      label: label || "",
      detail: detail || "",
      dateKey: dateKey || todayKey(),
      createdAt: new Date().toISOString(),
    };
  }

  window.AlpenglowUtils = {
    DAY_ORDER,
    DAY_LABELS,
    VOID_STATES,
    escapeHtml,
    clone,
    todayKey,
    currentDayKey,
    uid,
    accountName,
    accountSubtitle,
    stateNext,
    openItems,
    objectCount,
    formatDate,
    makeActivity,
  };
}());
