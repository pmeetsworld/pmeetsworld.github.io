export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bgi\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .replace(/^#\s*/, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

export function canonicalSkuKey({ itemNumber = "", name = "" } = {}) {
  const number = normalizeIdentifier(itemNumber);
  return number ? `item:${number}` : `name:${normalizeText(name)}`;
}

export function opportunityStateId(accountId, item = {}) {
  const sku = item.skuKey || item.key || canonicalSkuKey(item);
  return `${accountId}:${sku}`;
}
