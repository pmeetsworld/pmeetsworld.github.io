import test from "node:test";
import assert from "node:assert/strict";
import { createStore, MemoryStorage } from "../src/state/store.js";

test("report commits cannot alter field-layer data", async () => {
  const store = createStore(new MemoryStorage());
  store.mutateField("seed account", (field) => {
    field.accounts.acct_1 = {
      id: "acct_1",
      accountNumber: "1",
      name: "Test Account",
      nickname: "",
      town: "Kearney",
      storeNumber: "",
      type: "Independent"
    };
    field.routes.mon.push("acct_1");
  }, { undoable: false });

  const before = store.getState().field;
  const fingerprint = store.getFieldFingerprint();
  await store.commitReportImport("performance", (report) => {
    report.current.performance = { accounts: {}, importedAt: new Date().toISOString() };
  });

  assert.equal(store.getFieldFingerprint(), fingerprint);
  assert.deepEqual(store.getState().field, before);
});

test("a malicious import-side field mutation is rolled back", async () => {
  const store = createStore(new MemoryStorage());
  const before = store.getState().field;

  await assert.rejects(
    store.commitReportImport("bad import", () => {
      store.mutateField("illegal", (field) => {
        field.accounts.bad = { id: "bad", accountNumber: "999", name: "Bad" };
      }, { undoable: false });
    }),
    /protected field data/
  );

  assert.deepEqual(store.getState().field, before);
});

test("field changes remain undoable without touching reports", () => {
  const store = createStore(new MemoryStorage());
  const reportBefore = store.getState().report;
  store.mutateField("add note", (field) => {
    field.notes.note_1 = { id: "note_1", accountId: "acct_1", body: "Remember this" };
  });
  assert.ok(store.getState().field.notes.note_1);
  assert.equal(store.undo(), true);
  assert.equal(store.getState().field.notes.note_1, undefined);
  assert.deepEqual(store.getState().report, reportBefore);
});
