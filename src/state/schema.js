import {
  DAY_DEFS,
  normalizeOpportunityState,
  SCHEMA_VERSION
} from "../config.js?v=1.1.0";
import { routeDayForDate, weekKey } from "../domain/dates.js?v=1.1.0";
import { canonicalSkuKey } from "../domain/identity.js?v=1.1.0";

function nowIso() {
  return new Date().toISOString();
}

function emptyRoutes() {
  return Object.fromEntries(DAY_DEFS.map((day) => [day.id, []]));
}

export function createEmptyFieldState() {
  const now = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    accounts: {},
    routes: emptyRoutes(),
    visits: {},
    notes: {},
    tasks: {},
    followUps: {},
    compliance: {},
    priceBooks: {},
    skuCatalog: {},
    opportunityStates: {},
    eliteStates: {},
    preorderStates: {},
    activity: [],
    dayNotes: {},
    healthLog: {},
    activeRoute: null,
    settings: {
      firstName: "P.",
      theme: "light",
      sampleLoaded: false,
      legacyRosterImportedAt: null,
      legacyRosterSource: null,
      lastBackupAt: null
    }
  };
}

export function createEmptyReportState() {
  const now = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    current: {
      performance: null,
      segmentPerformance: null,
      customerMovers: null,
      perfectLaunch: null,
      scaleUp: null,
      chainVoid: null,
      perfectLaunchCatalog: null,
      eliteAssignments: null,
      preorders: null,
      pfpScorecard: null
    },
    snapshots: [],
    review: {},
    links: {},
    exclusions: {},
    lastImportAt: null
  };
}

export function createEmptyUiState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    route: "home",
    routeDay: routeDayForDate(new Date()),
    routeWeek: weekKey(new Date()),
    accountId: null,
    accountTab: "today",
    importTab: "reports",
    search: "",
    sort: "order",
    overlay: null,
    toast: null
  };
}

function mergeOpportunityState(current, candidate) {
  const precedence = {
    Open: 0,
    Pitched: 1,
    "Not in Set": 2,
    "On Shelf": 3,
    "Sold In": 4
  };
  const normalizedCurrent = current ? normalizeOpportunityState(current) : null;
  const normalizedCandidate = normalizeOpportunityState(candidate);
  return (precedence[normalizedCandidate] ?? 0) > (precedence[normalizedCurrent] ?? -1)
    ? normalizedCandidate
    : normalizedCurrent;
}

function migrateOpportunityStates(states = {}) {
  const migrated = {};
  const reportTypes = ["chainVoid", "scaleUp", "perfectLaunch"];
  for (const [id, value] of Object.entries(states)) {
    const reportType = reportTypes.find((type) => id.startsWith(`${type}:`));
    let nextId = id;
    if (reportType) {
      const remainder = id.slice(reportType.length + 1);
      const separator = remainder.indexOf(":");
      if (separator >= 0) {
        const accountId = remainder.slice(0, separator);
        const oldItemKey = remainder.slice(separator + 1);
        const itemName = oldItemKey.includes(":")
          ? oldItemKey.slice(oldItemKey.indexOf(":") + 1)
          : oldItemKey;
        nextId = `${accountId}:${canonicalSkuKey({ name: itemName })}`;
      }
    }
    migrated[nextId] = mergeOpportunityState(migrated[nextId], value);
  }
  return migrated;
}

function migrateReportItem(item = {}) {
  const skuKey = canonicalSkuKey({
    itemNumber: item.itemNumber,
    name: item.name
  });
  return {
    ...item,
    itemNumber: item.itemNumber || "",
    key: skuKey,
    skuKey
  };
}

function migrateReportAccount(account) {
  if (!account || typeof account !== "object") return account;
  return {
    ...account,
    items: (account.items || []).map(migrateReportItem)
  };
}

function migrateCurrentReports(current = {}) {
  return Object.fromEntries(Object.entries(current).map(([type, report]) => {
    if (!report) return [type, report];
    return [type, {
      ...report,
      accounts: Object.fromEntries(
        Object.entries(report.accounts || {}).map(([accountId, account]) => [
          accountId,
          migrateReportAccount(account)
        ])
      )
    }];
  }));
}

const migrations = {
  field: {
    0: (source) => {
      const clean = createEmptyFieldState();
      return {
        ...clean,
        ...source,
        routes: { ...clean.routes, ...(source.routes || {}) },
        settings: { ...clean.settings, ...(source.settings || {}) },
        schemaVersion: 1
      };
    },
    1: (source) => {
      const clean = createEmptyFieldState();
      return {
        ...clean,
        ...source,
        routes: { ...clean.routes, ...(source.routes || {}) },
        settings: { ...clean.settings, ...(source.settings || {}) },
        opportunityStates: migrateOpportunityStates(source.opportunityStates),
        schemaVersion: 2
      };
    },
    2: (source) => {
      const clean = createEmptyFieldState();
      return {
        ...clean,
        ...source,
        routes: { ...clean.routes, ...(source.routes || {}) },
        settings: { ...clean.settings, ...(source.settings || {}) },
        eliteStates: source.eliteStates || {},
        preorderStates: source.preorderStates || {},
        schemaVersion: 3
      };
    }
  },
  report: {
    0: (source) => {
      const clean = createEmptyReportState();
      return {
        ...clean,
        ...source,
        current: { ...clean.current, ...(source.current || {}) },
        schemaVersion: 1
      };
    },
    1: (source) => {
      const clean = createEmptyReportState();
      return {
        ...clean,
        ...source,
        current: migrateCurrentReports({ ...clean.current, ...(source.current || {}) }),
        review: Object.fromEntries(
          Object.entries(source.review || {}).map(([id, review]) => [
            id,
            {
              ...review,
              group: migrateReportAccount(review.group)
            }
          ])
        ),
        schemaVersion: 2
      };
    },
    2: (source) => {
      const clean = createEmptyReportState();
      return {
        ...clean,
        ...source,
        current: { ...clean.current, ...(source.current || {}) },
        schemaVersion: 3
      };
    }
  },
  ui: {
    0: (source) => ({
      ...createEmptyUiState(),
      ...source,
      schemaVersion: 1
    }),
    1: (source) => ({
      ...createEmptyUiState(),
      ...source,
      schemaVersion: 2
    }),
    2: (source) => ({
      ...createEmptyUiState(),
      ...source,
      schemaVersion: 3
    })
  }
};

export function migrateLayer(layer, source) {
  if (!["field", "report", "ui"].includes(layer)) {
    throw new Error(`Unknown state layer: ${layer}`);
  }

  let state = source && typeof source === "object" ? structuredClone(source) : {};
  let version = Number.isInteger(state.schemaVersion) ? state.schemaVersion : 0;

  if (version > SCHEMA_VERSION) {
    throw new Error(`Stored ${layer} data uses a newer schema (${version}).`);
  }

  while (version < SCHEMA_VERSION) {
    const migrate = migrations[layer][version];
    if (!migrate) throw new Error(`Missing ${layer} migration from schema ${version}.`);
    state = migrate(state);
    version = state.schemaVersion;
  }

  if (layer === "field") {
    state.skuCatalog ||= {};
    state.opportunityStates = migrateOpportunityStates(state.opportunityStates);
  }

  return state;
}
