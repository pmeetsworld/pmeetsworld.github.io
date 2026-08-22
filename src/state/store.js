import { STORAGE_KEYS } from "../config.js?v=1.1.0";
import {
  createEmptyFieldState,
  createEmptyReportState,
  createEmptyUiState,
  migrateLayer
} from "./schema.js?v=1.1.0";

function clone(value) {
  return structuredClone(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function fingerprint(value) {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function readLayer(storage, layer, fallback) {
  const raw = storage.getItem(STORAGE_KEYS[layer]);
  if (!raw) return fallback();
  try {
    return migrateLayer(layer, JSON.parse(raw));
  } catch (error) {
    console.error(`Unable to read ${layer} state`, error);
    return fallback();
  }
}

export function createStore(storage = globalThis.localStorage || new MemoryStorage()) {
  let field = readLayer(storage, "field", createEmptyFieldState);
  let report = readLayer(storage, "report", createEmptyReportState);
  let ui = readLayer(storage, "ui", createEmptyUiState);
  const listeners = new Set();
  const undoStack = [];

  function persist(layer) {
    const value = layer === "field" ? field : layer === "report" ? report : ui;
    storage.setItem(STORAGE_KEYS[layer], JSON.stringify(value));
  }

  function emit(detail = {}) {
    const snapshot = api.getState();
    for (const listener of listeners) listener(snapshot, detail);
  }

  function finishLayer(layer, next, detail) {
    next.updatedAt = new Date().toISOString();
    if (layer === "field") field = next;
    if (layer === "report") report = next;
    if (layer === "ui") ui = next;
    persist(layer);
    emit({ layer, ...detail });
  }

  const api = {
    getState() {
      return { field: clone(field), report: clone(report), ui: clone(ui) };
    },

    getFieldFingerprint() {
      return fingerprint(field);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    mutateField(label, mutation, options = {}) {
      const previous = clone(field);
      const draft = clone(field);
      const returned = mutation(draft);
      const next = returned && typeof returned === "object" ? returned : draft;
      if (options.undoable !== false) {
        undoStack.push({ label, field: previous });
        if (undoStack.length > 20) undoStack.shift();
      }
      finishLayer("field", migrateLayer("field", next), {
        label,
        undoable: options.undoable !== false
      });
    },

    mutateReport(label, mutation) {
      const draft = clone(report);
      const returned = mutation(draft);
      finishLayer(
        "report",
        migrateLayer("report", returned && typeof returned === "object" ? returned : draft),
        { label }
      );
    },

    mutateUi(mutation) {
      const draft = clone(ui);
      const returned = mutation(draft);
      finishLayer(
        "ui",
        migrateLayer("ui", returned && typeof returned === "object" ? returned : draft),
        { label: "UI updated" }
      );
    },

    async commitReportImport(label, mutation) {
      const protectedField = clone(field);
      const protectedFingerprint = fingerprint(protectedField);
      const draft = clone(report);
      const returned = await mutation(draft);

      if (fingerprint(field) !== protectedFingerprint) {
        field = protectedField;
        persist("field");
        emit({ layer: "field", label: "Blocked report import field mutation" });
        throw new Error("Report import attempted to alter protected field data.");
      }

      finishLayer(
        "report",
        migrateLayer("report", returned && typeof returned === "object" ? returned : draft),
        { label }
      );
    },

    replaceField(next, label = "Field data restored") {
      finishLayer("field", migrateLayer("field", next), { label, undoable: false });
    },

    replaceReport(next, label = "Report data restored") {
      finishLayer("report", migrateLayer("report", next), { label });
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      field = migrateLayer("field", entry.field);
      persist("field");
      emit({ layer: "field", label: `Undid ${entry.label}`, undoable: false });
      return true;
    },

    canUndo() {
      return undoStack.length > 0;
    },

    resetAll() {
      field = createEmptyFieldState();
      report = createEmptyReportState();
      ui = createEmptyUiState();
      undoStack.length = 0;
      persist("field");
      persist("report");
      persist("ui");
      emit({ layer: "all", label: "All data cleared" });
    }
  };

  persist("field");
  persist("report");
  persist("ui");
  return api;
}
