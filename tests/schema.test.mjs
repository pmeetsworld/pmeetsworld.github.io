import test from "node:test";
import assert from "node:assert/strict";
import { PREORDER_STATES } from "../src/config.js";
import { migrateLayer } from "../src/state/schema.js";

test("schema migration fills required weekday routes", () => {
  const migrated = migrateLayer("field", { schemaVersion: 0, routes: { mon: ["a"] } });
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.routes.mon, ["a"]);
  assert.deepEqual(migrated.routes.fri, []);
  assert.deepEqual(migrated.eliteStates, {});
  assert.deepEqual(migrated.preorderStates, {});
});

test("legacy tracker-specific opportunity states merge by account and SKU", () => {
  const migrated = migrateLayer("field", {
    schemaVersion: 1,
    opportunityStates: {
      "chainVoid:acct_1:alcohol:nutrl pineapple": "Pitched",
      "scaleUp:acct_1:alcohol:nutrl pineapple": "Sold In"
    }
  });
  assert.deepEqual(migrated.opportunityStates, {
    "acct_1:name:nutrl pineapple": "Sold In"
  });
});

test("legacy No Fit opportunity states migrate to Not in Set", () => {
  const migrated = migrateLayer("field", {
    schemaVersion: 3,
    opportunityStates: {
      "acct_1:name:nutrl pineapple": "No Fit"
    }
  });
  assert.equal(migrated.opportunityStates["acct_1:name:nutrl pineapple"], "Not in Set");
});

test("legacy already-in-account states migrate to On Shelf", () => {
  const migrated = migrateLayer("field", {
    schemaVersion: 3,
    opportunityStates: {
      "acct_1:name:nutrl pineapple": "Already in Account"
    }
  });
  assert.equal(migrated.opportunityStates["acct_1:name:nutrl pineapple"], "On Shelf");
});

test("preorders can be resolved as not suitable for the account", () => {
  assert.ok(PREORDER_STATES.includes("Not suitable for account"));
});

test("future schemas fail closed", () => {
  assert.throws(() => migrateLayer("field", { schemaVersion: 99 }), /newer schema/);
});
