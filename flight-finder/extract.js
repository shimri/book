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
  const add = (c, s, m) => {
    const cur = code(c), n = parseInt(s.replace(/,/g, ""), 10);
    if (!cur) return;
    const [lo, hi] = cur === "ILS" ? [150, 40000] : [40, 15000];
    if (n >= lo && n <= hi) (buckets[cur] = buckets[cur] || []).push({ n, ctx: text.slice(Math.max(0, m.index - 35), m.index + m[0].length + 35).replace(/\s+/g, " ").trim() });
  };
  for (const m of text.matchAll(pre)) add(m[1], m[2], m);
  for (const m of text.matchAll(post)) add(m[2], m[1], m);
  let cur = wanted && buckets[wanted] ? wanted : null;
  if (!cur) cur = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0] || null;
  if (!cur) return { min: null, count: 0, currency: wanted || null };
  let arr = buckets[cur].slice().sort((a, b) => a.n - b.n);
  // Drop outliers (e.g. "from $40/day" car-rental ads) that are far below the typical fare on the page.
  if (arr.length >= 5) { const med = arr[Math.floor(arr.length / 2)].n; arr = arr.filter((x) => x.n >= 0.4 * med); }
  return { min: arr[0].n, ctx: arr[0].ctx, count: arr.length, currency: cur };
}
