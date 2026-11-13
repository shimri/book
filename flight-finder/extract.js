// Self-contained: runs inside a web page (via chrome.scripting) and in the popup.
// Finds ILS prices in visible text + aria-labels and returns the lowest plausible one.
function extractPrices() {
  const chunks = [document.body ? document.body.innerText : ""];
  document.querySelectorAll("[aria-label]").forEach((e) => chunks.push(e.getAttribute("aria-label")));
  const text = chunks.join("\n");
  const re = /(?:₪|ILS|NIS)\s?(\d{1,3}(?:,\d{3})+|\d{3,6})|(\d{1,3}(?:,\d{3})+|\d{3,6})\s?(?:₪|ILS|NIS|Israeli new shekels?)/gi;
  const found = [];
  for (const m of text.matchAll(re)) {
    const n = parseInt((m[1] || m[2]).replace(/,/g, ""), 10);
    if (n >= 150 && n <= 40000) found.push(n);
  }
  return { min: found.length ? Math.min(...found) : null, count: found.length };
}
