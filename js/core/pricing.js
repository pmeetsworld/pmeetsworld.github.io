/* Alpenglow pricing calculations. */
(function () {
  "use strict";

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = num(value);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "-";
  }

  function pct(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-";
  }

  function marginInput(value) {
    const n = num(value);
    if (!n) return 0;
    return n > 1 ? n / 100 : n;
  }

  function calculate(item) {
    const caseCost = num(item.caseCost);
    const unitsPerCase = num(item.unitsPerCase);
    const retailPrice = num(item.retailPrice);
    const retailUnitQty = num(item.retailUnitQty) || 1;
    const targetMargin = marginInput(item.targetMargin);
    const unitCost = caseCost && unitsPerCase ? caseCost / unitsPerCase : null;
    const retailUnit = retailPrice ? retailPrice / retailUnitQty : null;
    const currentMargin = retailUnit && unitCost !== null ? (retailUnit - unitCost) / retailUnit : null;
    const marginGap = targetMargin && currentMargin !== null ? currentMargin - targetMargin : null;
    const suggestedUnitRetail = targetMargin && targetMargin < 1 && unitCost !== null ? unitCost / (1 - targetMargin) : null;
    const suggestedRetail = suggestedUnitRetail !== null ? suggestedUnitRetail * retailUnitQty : null;
    const twoForEquivalent = num(item.twoForPrice) ? num(item.twoForPrice) / 2 : null;

    return {
      unitCost,
      retailUnit,
      currentMargin,
      targetMargin,
      marginGap,
      suggestedRetail,
      twoForEquivalent,
    };
  }

  window.AlpenglowPricing = {
    calculate,
    money,
    pct,
  };
}());
