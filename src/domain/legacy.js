import { DAY_DEFS } from "../config.js?v=1.1.0";
import { normalizeIdentifier, normalizeText } from "./identity.js?v=1.1.0";

const ACCOUNT_TYPES = Object.freeze({
  C: "Chain",
  I: "Independent",
  O: "On-Premise",
  D: "DSD"
});

const FREQUENCIES = Object.freeze({
  W: "Weekly",
  EOW: "Bi-Weekly",
  M: "Monthly"
});

const KNOWN_TOWNS = Object.freeze([
  "Grand Island",
  "Kearney",
  "Lexington",
  "Ravenna",
  "Cairo",
  "Elm Creek",
  "Overton",
  "Odessa"
]);

function accountNumberFromLegacy(value) {
  return String(value || "").trim().replace(/^#\s*/, "");
}

function storeNumberFromName(value) {
  const text = String(value || "");
  const explicit = text.match(/#\s*(\d{2,6})\b/);
  if (explicit) return explicit[1];
  const trailing = text.match(/\b(\d{3,6})\s*$/);
  return trailing ? trailing[1] : "";
}

function townFromName(value) {
  const normalized = normalizeText(value);
  if (/\blex\b/.test(normalized)) return "Lexington";
  return KNOWN_TOWNS.find((town) => normalized.includes(normalizeText(town))) || "";
}

function routeDaysFor(entry) {
  const allowed = new Set(DAY_DEFS.map((day) => day.id));
  return [...new Set((entry.days || []).filter((day) => allowed.has(day)))];
}

export function parseLegacyRosterBackup(source, importedAt = new Date().toISOString()) {
  const backup = typeof source === "string" ? JSON.parse(source) : source;
  if (!backup || !Array.isArray(backup.roster)) {
    throw new Error("This is not a Route 508 v0.6 roster backup.");
  }

  const seen = new Set();
  const entries = backup.roster.map((entry, sourceIndex) => {
    const accountNumber = accountNumberFromLegacy(entry.id);
    const identity = normalizeIdentifier(accountNumber);
    if (!identity) throw new Error(`Roster row ${sourceIndex + 1} has no account number.`);
    if (seen.has(identity)) throw new Error(`Account number ${accountNumber} appears more than once.`);
    seen.add(identity);

    const name = String(entry.name || "").trim();
    if (!name) throw new Error(`Account ${accountNumber} has no name.`);
    const routeDays = routeDaysFor(entry);
    return {
      sourceIndex,
      routeDays,
      order: entry.order || {},
      account: {
        id: `acct_${identity}`,
        accountNumber,
        name,
        nickname: String(entry.nick || "").trim(),
        town: townFromName(`${name} ${entry.nick || ""}`),
        storeNumber: storeNumberFromName(name),
        type: ACCOUNT_TYPES[String(entry.type || "").toUpperCase()] || "Independent",
        tags: [],
        frequency: routeDays.length > 1
          ? "Twice Weekly"
          : FREQUENCIES[String(entry.freq || "").toUpperCase()] || "Weekly",
        buyer: "",
        phone: "",
        email: "",
        address: "",
        objective: "",
        createdAt: importedAt,
        updatedAt: importedAt
      }
    };
  });

  const accounts = Object.fromEntries(entries.map(({ account }) => [account.id, account]));
  const routes = Object.fromEntries(DAY_DEFS.map((day) => {
    const ordered = entries
      .filter((entry) => entry.routeDays.includes(day.id))
      .sort((left, right) => {
        const leftOrder = Number(left.order?.[day.id]);
        const rightOrder = Number(right.order?.[day.id]);
        const leftRank = Number.isFinite(leftOrder) ? leftOrder : left.sourceIndex;
        const rightRank = Number.isFinite(rightOrder) ? rightOrder : right.sourceIndex;
        return leftRank - rightRank || left.sourceIndex - right.sourceIndex;
      })
      .map((entry) => entry.account.id);
    return [day.id, ordered];
  }));

  return {
    accounts,
    routes,
    accountCount: entries.length,
    exportedAt: backup.exportedAt || null,
    importedAt,
    sourceName: "Route 508 v0.6 roster"
  };
}

export async function parseLegacyRosterFile(file) {
  return parseLegacyRosterBackup(await file.text());
}
