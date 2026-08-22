import { canonicalSkuKey } from "./identity.js?v=1.1.0";

export function priceCatalogKey(item = {}) {
  return item.catalogKey || canonicalSkuKey({ name: item.sku });
}

export function calculatePriceMetrics({
  caseCost = 0,
  unitsPerCase = 0,
  retail = 0,
  targetMargin = 0,
  twoFor = 0,
  twoForEnabled = false
} = {}) {
  const unitCost = unitsPerCase ? caseCost / unitsPerCase : 0;
  const currentMargin = retail && unitCost ? ((retail - unitCost) / retail) * 100 : null;
  const targetRetail = unitCost && targetMargin < 100 ? unitCost / (1 - targetMargin / 100) : null;
  const twoForRetail = twoForEnabled && twoFor ? twoFor / 2 : 0;
  const twoForMargin = twoForRetail && unitCost ? ((twoForRetail - unitCost) / twoForRetail) * 100 : null;
  return { unitCost, currentMargin, targetRetail, twoForRetail, twoForMargin };
}

export function resolvePriceEntry(field, item = {}) {
  const catalogKey = priceCatalogKey(item);
  const catalog = field.skuCatalog?.[catalogKey] || {};
  const values = {
    ...item,
    catalogKey,
    sku: item.sku || catalog.sku || "",
    caseCost: Number(catalog.caseCost ?? item.caseCost) || 0,
    unitsPerCase: Number(catalog.unitsPerCase ?? item.unitsPerCase) || 0
  };
  return { ...values, ...calculatePriceMetrics(values) };
}
