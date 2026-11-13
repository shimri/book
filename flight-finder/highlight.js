// Self-contained: runs inside a web page (via chrome.scripting). Finds the element showing `price`
// (best match to the context snippet), outlines it, scrolls to it and shows a small label.
// Returns true when highlighted. Safe to call repeatedly (pages render results late).
function highlightPrice(price, cur, ctx, label) {
  if (document.documentElement.dataset.cfHl === String(price)) return true;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sym = { USD: "$", EUR: "€", ILS: "₪", GBP: "£" }[cur] || "";
  const num = price >= 1000 ? `${Math.floor(price / 1000)},${String(price % 1000).padStart(3, "0")}` : String(price);
  const codes = "USD|EUR|ILS|NIS|GBP";
  const re = new RegExp(`(?:^|[^\\d,.])(?:${sym ? esc(sym) + "\\s?" + num + "|" + num + "\\s?" + esc(sym) + "|" : ""}(?:${codes})\\s?${num}|${num}\\s?(?:${codes}|shekels?|dollars?))(?!\\d)`, "i");
  const matches = (el) => el.innerText && el.innerText.length <= 60 && re.test(el.innerText);
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  let cands = [...document.body.querySelectorAll("*")].filter((el) => matches(el) && visible(el));
  cands = cands.filter((el) => ![...el.children].some((c) => matches(c))); // deepest only
  if (!cands.length) return false;
  const words = (ctx || "").toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const BAD = /hotel|\broom|\bnights?\b|\bcar\b|\brental|per day|מלון|חדר|לילה|השכרת|רכב/i;
  // The "card" around a price: the largest ancestor that holds this candidate and no other matching price.
  const card = (el) => {
    let n = el;
    while (n.parentElement && n.parentElement !== document.body && (n.parentElement.innerText || "").length <= 800
           && !cands.some((c) => c !== el && n.parentElement.contains(c))) n = n.parentElement;
    return n;
  };
  const score = (el) => {
    const t = card(el).innerText.toLowerCase();
    return words.filter((w) => t.includes(w)).length - (BAD.test(t) ? 100 : 0);
  };
  const best = cands.map((el) => [el, score(el)]).sort((a, b) => b[1] - a[1])[0][0];
  best.style.cssText += ";outline:3px solid #12874a !important;outline-offset:3px;border-radius:6px;background:rgba(18,135,74,.18) !important;box-shadow:0 0 0 6px rgba(18,135,74,.25) !important;transition:all .3s";
  best.scrollIntoView({ block: "center", behavior: "smooth" });
  const tag = document.createElement("div");
  tag.textContent = "✓ " + label;
  tag.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#12874a;color:#fff;font:600 13px system-ui,Arial,sans-serif;padding:8px 14px;border-radius:99px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer";
  tag.title = "×";
  tag.addEventListener("click", () => { tag.remove(); best.style.outline = best.style.background = best.style.boxShadow = ""; document.documentElement.dataset.cfHl = ""; });
  document.body.appendChild(tag);
  document.documentElement.dataset.cfHl = String(price);
  return true;
}
