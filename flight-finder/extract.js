// Self-contained: runs inside a web page (via chrome.scripting) and in the popup.
// Finds prices (USD/EUR/ILS/GBP) in visible text + aria-labels; returns the lowest plausible one.
function extractPrices(wanted) {
  const chunks = [document.body ? document.body.innerText : ""];
  document.querySelectorAll("[aria-label]").forEach((e) => chunks.push(e.getAttribute("aria-label")));
  const text = chunks.join("\n");
  const code = (t) => {
    t = t.toLowerCase();
    if (/₪|ils|nis|shekel/.test(t)) return "ILS";
    if (/\$|usd|dollar/.test(t)) return "USD";
    if (/€|eur/.test(t)) return "EUR";
    if (/£|gbp/.test(t)) return "GBP";
    return null;
  };
  const NUM = "(\\d{1,3}(?:,\\d{3})+|\\d{2,6})";
  const CUR = "([$€₪£]|USD|EUR|ILS|NIS|GBP|Israeli new shekels?|US dollars?|euros?)";
  const pre = new RegExp(CUR + "\\s?" + NUM + "(?!\\d)", "gi");
  const post = new RegExp(NUM + "\\s?" + CUR, "gi");
  const buckets = {};
  const add = (c, s) => {
    const cur = code(c), n = parseInt(s.replace(/,/g, ""), 10);
    if (!cur) return;
    const [lo, hi] = cur === "ILS" ? [150, 40000] : [40, 15000];
    if (n >= lo && n <= hi) (buckets[cur] = buckets[cur] || []).push(n);
  };
  for (const m of text.matchAll(pre)) add(m[1], m[2]);
  for (const m of text.matchAll(post)) add(m[2], m[1]);
  let cur = wanted && buckets[wanted] ? wanted : null;
  if (!cur) cur = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0] || null;
  if (!cur) return { min: null, count: 0, currency: wanted || null };
  return { min: Math.min(...buckets[cur]), count: buckets[cur].length, currency: cur };
}
