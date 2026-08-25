// Formatting helpers (European number format: 1.234,56)
const Format = (function () {
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return 0;
    const s = String(raw).trim();
    if (s === "" || s === "-") return 0;
    const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }

  // Format a number as 1.234,56
  function number(value) {
    const n = Number(value) || 0;
    const neg = n < 0;
    const abs = Math.abs(n);
    const parts = abs.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + parts[0] + "," + parts[1];
  }

  // Show empty string for 0 / 0.00 (FR-031)
  function amountOrBlank(value) {
    const n = Number(value) || 0;
    if (n === 0) return "";
    return number(n);
  }

  // Percentage rounded to two decimals, European format with % suffix
  function percent(value) {
    const n = Number(value) || 0;
    return number(n) + "%";
  }

  // Parse dd.mm.yyyy -> Date (or null)
  function parseDate(str) {
    if (!str || str.trim() === "" || str.trim() === "-") return null;
    const m = str.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  return { parseAmount, number, amountOrBlank, percent, parseDate };
})();
