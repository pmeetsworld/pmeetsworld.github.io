import test from "node:test";
import assert from "node:assert/strict";
import { calculatePriceMetrics, resolvePriceEntry } from "../src/domain/pricing.js";

test("price math calculates unit, current, target, and two-for margins", () => {
  const metrics = calculatePriceMetrics({
    caseCost: 24,
    unitsPerCase: 12,
    retail: 3,
    targetMargin: 40,
    twoForEnabled: true,
    twoFor: 5
  });
  assert.equal(metrics.unitCost, 2);
  assert.equal(Math.round(metrics.currentMargin * 10) / 10, 33.3);
  assert.equal(Math.round(metrics.targetRetail * 100) / 100, 3.33);
  assert.equal(metrics.twoForRetail, 2.5);
  assert.equal(metrics.twoForMargin, 20);
});

test("shared SKU catalog values override account copies without replacing retail", () => {
  const field = {
    skuCatalog: {
      "name:test sku": { sku: "Test SKU", caseCost: 30, unitsPerCase: 12 }
    }
  };
  const resolved = resolvePriceEntry(field, {
    sku: "Test SKU",
    catalogKey: "name:test sku",
    caseCost: 24,
    unitsPerCase: 6,
    retail: 4
  });
  assert.equal(resolved.caseCost, 30);
  assert.equal(resolved.unitsPerCase, 12);
  assert.equal(resolved.retail, 4);
  assert.equal(resolved.currentMargin, 37.5);
});
